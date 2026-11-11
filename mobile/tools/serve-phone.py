#!/usr/bin/env python3
"""Serve a prepared Path Mobile build over local HTTPS after a manual launch.

This helper never changes firewall rules, installs trust, discovers devices or
starts a tunnel. LAN access requires both an explicit private IPv4 address and
--allow-lan. --public-ca is a separate HTTP bootstrap mode serving ONE public
certificate, never the application or a directory.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
from pathlib import Path
import shutil
import ssl
from urllib.parse import unquote, urlsplit


CA_ROUTE = "/Path-Mobile-Local-CA.cer"
MAX_CA_BYTES = 128 * 1024
PRIVATE_NETWORKS = tuple(ipaddress.ip_network(net) for net in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))
MIME = {
    ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".ico": "image/x-icon", ".ttf": "font/ttf",
    ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
}


class SetupError(ValueError):
    """An actionable setup error, with no certificate/key contents in output."""


@dataclass(frozen=True)
class Config:
    bind: str
    port: int
    root: Path | None = None
    cert: Path | None = None
    key: Path | None = None
    ca_bytes: bytes | None = None

    @property
    def bootstrap(self) -> bool:
        return self.ca_bytes is not None


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = result.add_mutually_exclusive_group(required=True)
    mode.add_argument("--directory", type=Path, help="Compiled Path-Mobile folder (contains index.html, app.mjs and model.mjs). Requires --cert and --key.")
    mode.add_argument("--public-ca", type=Path, help="HTTP bootstrap: serve only this public X.509 certificate at " + CA_ROUTE + ". DER or PEM; never a private key.")
    result.add_argument("--bind", default="127.0.0.1", help="Explicit IPv4 address. Default 127.0.0.1 is computer-only; no wildcard/public addresses.")
    result.add_argument("--allow-lan", action="store_true", help="Acknowledge a manual LAN launch on the explicitly supplied RFC1918 address.")
    result.add_argument("--port", type=int, help="1..65535; default 8443 for HTTPS, 8019 for certificate-only bootstrap.")
    result.add_argument("--cert", type=Path, help="TLS certificate PEM outside the served folder.")
    result.add_argument("--key", type=Path, help="TLS private key PEM outside the served folder. Never copy it into Path-Mobile or Trust.")
    return result


def validate_bind(address: str, allow_lan: bool) -> str:
    try:
        ip = ipaddress.IPv4Address(address)
    except ipaddress.AddressValueError:
        raise SetupError("--bind must be one explicit IPv4 address, not a hostname or wildcard.") from None
    if ip.is_loopback:
        return str(ip)
    if not any(ip in network for network in PRIVATE_NETWORKS):
        raise SetupError("Only loopback or an explicit RFC1918 home-LAN IPv4 address is permitted.")
    if not allow_lan:
        raise SetupError("LAN access is disabled by default. Use --allow-lan only after choosing the device and access method.")
    return str(ip)


def existing_file(path: Path, label: str) -> Path:
    try:
        value = path.expanduser().resolve(strict=True)
    except (OSError, RuntimeError):
        raise SetupError(label + " file does not exist or cannot be read.") from None
    if not value.is_file():
        raise SetupError(label + " must name a file.")
    return value


def public_certificate(path: Path) -> bytes:
    value = existing_file(path, "Public CA")
    if "key" in value.name.lower() or value.suffix.lower() in {".key", ".p12", ".pfx"}:
        raise SetupError("--public-ca must not name a private key or key container.")
    try:
        data = value.read_bytes()
    except OSError:
        raise SetupError("Cannot read the public CA certificate.") from None
    if not data or len(data) > MAX_CA_BYTES:
        raise SetupError("Public CA certificate must be between 1 byte and 128 KiB.")
    if b"PRIVATE KEY" in data.upper() or b"ENCRYPTED KEY" in data.upper():
        raise SetupError("Private key material is forbidden in certificate-only bootstrap mode.")
    # OpenSSL validates the X.509 structure. It does not install trust anywhere.
    try:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ca_data = data.decode("ascii") if b"-----BEGIN CERTIFICATE-----" in data else data
        context.load_verify_locations(cadata=ca_data)
    except (ssl.SSLError, UnicodeError, ValueError):
        raise SetupError("Public CA must contain a valid DER or PEM X.509 certificate, without private key material.") from None
    return data


def prepare(args: argparse.Namespace) -> Config:
    bind = validate_bind(args.bind, args.allow_lan)
    bootstrap = args.public_ca is not None
    port = args.port if args.port is not None else 8019 if bootstrap else 8443
    if not 1 <= port <= 65535:
        raise SetupError("--port must be between 1 and 65535.")
    if bootstrap:
        if args.cert is not None or args.key is not None:
            raise SetupError("Certificate-only HTTP bootstrap cannot use --cert or --key.")
        return Config(bind, port, ca_bytes=public_certificate(args.public_ca))
    if args.cert is None or args.key is None:
        raise SetupError("Application serving requires HTTPS: provide both --cert and --key.")
    try:
        root = args.directory.expanduser().resolve(strict=True)
    except (OSError, RuntimeError):
        raise SetupError("Compiled Path-Mobile directory does not exist.") from None
    if not root.is_dir():
        raise SetupError("--directory must name the compiled Path-Mobile folder.")
    for name in ("index.html", "app.mjs", "model.mjs"):
        candidate = (root / name).resolve()
        if not candidate.is_relative_to(root) or not candidate.is_file():
            raise SetupError("Choose the compiled Path-Mobile folder containing index.html, app.mjs and model.mjs.")
    cert, key = existing_file(args.cert, "TLS certificate"), existing_file(args.key, "TLS key")
    if cert.is_relative_to(root) or key.is_relative_to(root):
        raise SetupError("TLS certificate and private key must be outside the served Path-Mobile folder.")
    return Config(bind, port, root, cert, key)


def static_file(root: Path, target: str) -> Path | None:
    """Resolve a URL without allowing traversal, hidden files or private assets."""
    try:
        if len(target) > 8192:
            return None
        url = urlsplit(target)
        if url.scheme or url.netloc or not url.path.startswith("/"):
            return None
        path = unquote(url.path, encoding="utf-8", errors="strict")
        if any(character in path for character in ("\\", "\x00", ":", "%")):
            return None
        parts = [part for part in path.split("/") if part]
        if any(part.startswith(".") or part.lower() == "private" for part in parts):
            return None
        candidate = root.joinpath(*parts)
        if path.endswith("/"):
            candidate /= "index.html"
        candidate = candidate.resolve(strict=True)
        if not candidate.is_relative_to(root) or not candidate.is_file() or candidate.suffix.lower() not in MIME:
            return None
        return candidate
    except (OSError, RuntimeError, UnicodeError, ValueError):
        return None


class PhoneHandler(BaseHTTPRequestHandler):
    server_version = "PathMobileLocal/1"
    sys_version = ""

    def __init__(self, *args, config: Config, **kwargs):
        self.config = config
        super().__init__(*args, **kwargs)

    def log_message(self, format, *args):
        # Do not collect request URLs/query strings or browser content as logs.
        pass

    def send_headers(self, status: int, mime: str, size: int, attachment: bool = False):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if attachment:
            self.send_header("Content-Disposition", 'attachment; filename="Path-Mobile-Local-CA.cer"')
        self.end_headers()

    def send_error(self, code, message=None, explain=None):
        # Constant body: never reflect an untrusted request path or error text.
        body = b"Not available.\n"
        self.send_headers(code, "text/plain; charset=utf-8", len(body))
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_content(self, head: bool):
        if self.config.bootstrap:
            # An exact route, no query aliases, no static directory in this mode.
            if self.path != CA_ROUTE:
                self.send_error(404)
                return
            data = self.config.ca_bytes
            self.send_headers(200, "application/x-x509-ca-cert", len(data), attachment=True)
            if not head:
                self.wfile.write(data)
            return
        candidate = static_file(self.config.root, self.path)
        if candidate is None:
            self.send_error(404)
            return
        try:
            with candidate.open("rb") as stream:
                self.send_headers(200, MIME[candidate.suffix.lower()], candidate.stat().st_size)
                if not head:
                    shutil.copyfileobj(stream, self.wfile)
        except OSError:
            self.send_error(404)

    def do_GET(self):
        self.send_content(False)

    def do_HEAD(self):
        self.send_content(True)


def serve(config: Config, server_type=ThreadingHTTPServer):
    context = None
    if not config.bootstrap:
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(str(config.cert), str(config.key))
        except (ssl.SSLError, OSError, ValueError):
            raise SetupError("Cannot load the supplied TLS certificate/key. Check their paths and PEM format.") from None
    # Construction/binding happens only after explicit CLI validation. The
    # application is never offered in plaintext if TLS setup fails.
    with server_type((config.bind, config.port), partial(PhoneHandler, config=config)) as server:
        if context:
            server.socket = context.wrap_socket(server.socket, server_side=True)
        scheme = "http" if config.bootstrap else "https"
        suffix = CA_ROUTE if config.bootstrap else "/?desktop-test=1"
        print(f"{scheme}://{config.bind}:{config.port}{suffix}", flush=True)
        print("Certificate-only HTTP bootstrap." if config.bootstrap else "Local HTTPS Path Mobile build.", flush=True)
        print("Foreground process. Stop with Ctrl+C. No firewall or trust settings are changed.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("Stopped.", flush=True)


def main(argv=None) -> int:
    arg_parser = parser()
    try:
        config = prepare(arg_parser.parse_args(argv))
        serve(config)
    except SetupError as error:
        arg_parser.exit(2, str(error) + "\n")
    except OSError:
        arg_parser.exit(2, "Cannot bind the explicitly selected address/port. Check the local IPv4 address and whether the port is already in use.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
