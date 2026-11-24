"""Wrap a Path MSI in the Windows installer without modifying the MSI."""
import argparse
import hashlib
import os
import subprocess
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
INSTALLER_NAME = "Path Installer.exe"


def package_installer(package, icon, out):
    package, icon, out = package.resolve(), icon.resolve(), out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    with package.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    template = (HERE / "Setup.cs").read_text(encoding="utf8")
    if template.count("MSI_SHA256_PLACEHOLDER") != 1:
        raise ValueError("Expected one embedded-package checksum in Setup.cs.")
    compiler = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    installer = out / INSTALLER_NAME
    with tempfile.TemporaryDirectory(dir=out) as scratch:
        source = Path(scratch) / "Setup.cs"
        source.write_text(template.replace("MSI_SHA256_PLACEHOLDER", digest), encoding="utf-8-sig")
        subprocess.run([
            str(compiler), "/nologo", "/target:winexe", "/platform:x64", "/optimize+",
            "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll",
            "/win32manifest:" + str(HERE / "setup.manifest"), "/win32icon:" + str(icon),
            "/resource:" + str(HERE / "PathMark.png") + ",PathMark.png",
            "/resource:" + str(package) + ",PathPreview.msi", "/out:" + str(installer), str(source)
        ], check=True)
    return installer


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ("msi", "icon", "out"):
        parser.add_argument(argument, type=Path)
    args = parser.parse_args()
    print(package_installer(args.msi, args.icon, args.out))
