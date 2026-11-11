"""Local helper tests: no sockets, listeners, real credentials or trust changes."""
import contextlib
import importlib.util
import io
from pathlib import Path
import ssl
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

SPEC = importlib.util.spec_from_file_location("path_phone_server", Path(__file__).resolve().parents[1] / "tools/serve-phone.py")
helper = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = helper
SPEC.loader.exec_module(helper)


class PhoneServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="path-phone-helper-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "Path-Mobile"
        self.root.mkdir()
        for name in ("index.html", "app.mjs", "model.mjs"):
            (self.root / name).write_text("SYNTHETIC PUBLIC BUILD", encoding="utf-8")
        self.private = self.base / "Private"
        self.private.mkdir()
        self.cert = self.private / "phone-cert.pem"
        self.key = self.private / "phone-key.pem"
        self.cert.write_text("SYNTHETIC CERTIFICATE PLACEHOLDER")
        self.key.write_text("SYNTHETIC NON-SECRET KEY PLACEHOLDER")

    def https_args(self, *extra):
        return helper.parser().parse_args(["--directory", str(self.root), "--cert", str(self.cert), "--key", str(self.key), *extra])

    def handler(self, config, target="/", command="GET"):
        value = helper.PhoneHandler.__new__(helper.PhoneHandler)
        value.config = config
        value.path = target
        value.command = command
        value.wfile = io.BytesIO()
        value.send_headers = MagicMock()
        return value

    def wire_response(self, config, target, command="GET"):
        class FakeConnection:
            def __init__(self, request):
                self.input = io.BytesIO(request)
                self.output = bytearray()

            def makefile(self, *args):
                return self.input

            def sendall(self, data):
                self.output.extend(data)

        connection = FakeConnection((command + " " + target + " HTTP/1.0\r\nHost: synthetic.invalid\r\n\r\n").encode())
        helper.PhoneHandler(connection, ("127.0.0.1", 1), MagicMock(), config=config)
        return bytes(connection.output)

    def test_no_server_is_created_when_importing_or_validating_default_config(self):
        with patch.object(helper, "ThreadingHTTPServer") as server:
            config = helper.prepare(self.https_args())
        server.assert_not_called()
        self.assertEqual((config.bind, config.port), ("127.0.0.1", 8443))
        self.assertEqual(config.root, self.root.resolve())

    def test_lan_requires_explicit_private_ipv4_and_acknowledgement(self):
        for ip in ("192.168.1.5", "10.10.0.2", "172.16.8.9"):
            with self.assertRaises(helper.SetupError):
                helper.validate_bind(ip, False)
            self.assertEqual(helper.validate_bind(ip, True), ip)
        for ip in ("0.0.0.0", "8.8.8.8", "169.254.1.2", "224.0.0.1", "::1", "localhost", "192.168.1.5:8443"):
            with self.assertRaises(helper.SetupError, msg=ip):
                helper.validate_bind(ip, True)

    def test_invalid_port_and_application_without_tls_rejected(self):
        for port in ("0", "65536"):
            with self.assertRaises(helper.SetupError):
                helper.prepare(self.https_args("--port", port))
        with self.assertRaises(helper.SetupError):
            helper.prepare(helper.parser().parse_args(["--directory", str(self.root)]))

    def test_cert_and_key_must_be_outside_served_root(self):
        for name in ("public-cert.pem", "private-key.pem"):
            path = self.root / name
            path.write_text("SYNTHETIC")
            args = self.https_args()
            if "key" in name:
                args.key = path
            else:
                args.cert = path
            with self.assertRaises(helper.SetupError):
                helper.prepare(args)

    def test_wrong_or_empty_static_directory_rejected(self):
        (self.root / "model.mjs").unlink()
        with self.assertRaises(helper.SetupError):
            helper.prepare(self.https_args())

    def test_static_paths_ignore_queries_and_never_list_directories(self):
        self.assertEqual(helper.static_file(self.root, "/?desktop-test=1"), self.root / "index.html")
        self.assertEqual(helper.static_file(self.root, "/app.mjs?v=synthetic"), self.root / "app.mjs")
        (self.root / "assets").mkdir()
        self.assertIsNone(helper.static_file(self.root, "/assets/"))
        (self.root / "assets/index.html").write_text("SYNTHETIC")
        self.assertEqual(helper.static_file(self.root, "/assets/"), self.root / "assets/index.html")

    def test_traversal_hidden_files_keys_and_encoded_escapes_are_rejected(self):
        (self.base / "outside.txt").write_text("SYNTHETIC OUTSIDE")
        (self.root / ".env").write_text("SYNTHETIC")
        (self.root / "private.pem").write_text("SYNTHETIC")
        (self.root / "Private").mkdir()
        (self.root / "Private/data.txt").write_text("SYNTHETIC")
        for target in ("/../outside.txt", "/%2e%2e/outside.txt", "/%252e%252e/outside.txt", "/assets%5c..%5cprivate.pem", "/C:/secret.txt", "/.env", "/private.pem", "/Private/data.txt", "/%00app.mjs", "https://elsewhere.invalid/app.mjs"):
            self.assertIsNone(helper.static_file(self.root, target), target)

    def test_symlink_escape_is_rejected(self):
        try:
            (self.root / "outside.txt").symlink_to(self.cert)
        except (OSError, NotImplementedError):
            self.skipTest("Symlinks unavailable on this test host")
        self.assertIsNone(helper.static_file(self.root, "/outside.txt"))

    def test_ca_bootstrap_reads_only_validated_public_bytes_not_keys(self):
        ca = self.base / "Trust.cer"
        ca.write_bytes(b"SYNTHETIC DER PUBLIC CERTIFICATE")
        with patch.object(helper.ssl, "SSLContext") as factory:
            config = helper.prepare(helper.parser().parse_args(["--public-ca", str(ca)]))
        factory.return_value.load_verify_locations.assert_called_once_with(cadata=ca.read_bytes())
        self.assertEqual(config.port, 8019)
        self.assertIsNone(config.root)
        data = config.ca_bytes
        ca.write_bytes(b"REPLACED AFTER VALIDATION")
        for command in ("GET", "HEAD"):
            handler = self.handler(config, helper.CA_ROUTE, command)
            handler.send_content(command == "HEAD")
            handler.send_headers.assert_called_once_with(200, "application/x-x509-ca-cert", len(data), attachment=True)
            self.assertEqual(handler.wfile.getvalue(), b"" if command == "HEAD" else data)
        for target in ("/", "/app.mjs", "/rootCA-key.pem", "/Path-Mobile-Local-CA.cer?x=1"):
            handler = self.handler(config, target)
            handler.send_content(False)
            self.assertEqual(handler.send_headers.call_args.args[0], 404)

    def test_pem_ca_supported_but_private_key_markers_and_invalid_der_rejected(self):
        ca = self.base / "public.cer"
        pem = "-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----"
        ca.write_text(pem)
        with patch.object(helper.ssl, "SSLContext") as factory:
            self.assertEqual(helper.public_certificate(ca), pem.encode())
        factory.return_value.load_verify_locations.assert_called_once_with(cadata=pem)
        ca.write_bytes(b"-----BEGIN PRIVATE KEY-----\nSYNTHETIC")
        with self.assertRaises(helper.SetupError):
            helper.public_certificate(ca)
        with self.assertRaises(helper.SetupError):
            helper.public_certificate(self.key)
        ca.write_bytes(b"not a DER certificate")
        with self.assertRaises(helper.SetupError):
            helper.public_certificate(ca)

    def test_headers_disable_cache_and_content_sniffing(self):
        handler = helper.PhoneHandler.__new__(helper.PhoneHandler)
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()
        helper.PhoneHandler.send_headers(handler, 200, "text/javascript; charset=utf-8", 3)
        self.assertIn(unittest.mock.call("Cache-Control", "no-store"), handler.send_header.call_args_list)
        self.assertIn(unittest.mock.call("X-Content-Type-Options", "nosniff"), handler.send_header.call_args_list)

    def test_actual_handler_parser_static_response_without_socket(self):
        config = helper.prepare(self.https_args())
        response = self.wire_response(config, "/app.mjs?build=synthetic")
        headers, body = response.split(b"\r\n\r\n", 1)
        self.assertIn(b"200 OK", headers)
        self.assertIn(b"Content-Type: text/javascript; charset=utf-8", headers)
        self.assertIn(b"Cache-Control: no-store", headers)
        self.assertEqual(body, b"SYNTHETIC PUBLIC BUILD")
        self.assertEqual(self.wire_response(config, "/app.mjs", "HEAD").split(b"\r\n\r\n", 1)[1], b"")
        denied = self.wire_response(config, "/%2e%2e/private.pem")
        self.assertIn(b"404 Not Found", denied)
        self.assertNotIn(b"private.pem", denied)

    def test_actual_handler_bootstrap_exposes_one_route_without_socket(self):
        config = helper.Config("127.0.0.1", 8019, ca_bytes=b"SYNTHETIC VALIDATED CERTIFICATE")
        response = self.wire_response(config, helper.CA_ROUTE)
        self.assertIn(b"Content-Type: application/x-x509-ca-cert", response)
        self.assertIn(b'filename="Path-Mobile-Local-CA.cer"', response)
        self.assertTrue(response.endswith(config.ca_bytes))
        self.assertIn(b"404 Not Found", self.wire_response(config, "/"))
        self.assertIn(b"404 Not Found", self.wire_response(config, "/app.mjs"))

    def test_https_tls12_and_keyboard_interrupt_cleanup_without_listening(self):
        config = helper.prepare(self.https_args())
        factory = MagicMock()
        server = factory.return_value.__enter__.return_value
        server.serve_forever.side_effect = KeyboardInterrupt()
        with patch.object(helper.ssl, "SSLContext") as ssl_factory, contextlib.redirect_stdout(io.StringIO()):
            helper.serve(config, server_type=factory)
        factory.assert_called_once()
        self.assertEqual(factory.call_args.args[0], ("127.0.0.1", 8443))
        ssl_factory.return_value.load_cert_chain.assert_called_once_with(str(self.cert), str(self.key))
        self.assertEqual(ssl_factory.return_value.minimum_version, ssl.TLSVersion.TLSv1_2)
        ssl_factory.return_value.wrap_socket.assert_called_once()
        factory.return_value.__exit__.assert_called_once()

    def test_invalid_tls_never_falls_back_to_plaintext_or_binds_a_socket(self):
        config = helper.prepare(self.https_args())
        factory = MagicMock()
        with patch.object(helper.ssl, "SSLContext") as ssl_factory:
            ssl_factory.return_value.load_cert_chain.side_effect = ssl.SSLError("SYNTHETIC BAD FORMAT")
            with self.assertRaises(helper.SetupError):
                helper.serve(config, server_type=factory)
        factory.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
