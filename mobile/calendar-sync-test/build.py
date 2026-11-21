"""Build the isolated Windows + iPhone Calendar test in a fresh output directory."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def build(output, fresh=False):
    if output.exists() and any(output.iterdir()):
        raise ValueError("Choose an empty output directory")
    app = output / "www/calendar-test"
    desktop, mobile = app / "desktop", app / "mobile"
    for script in (ROOT / "build.py", ROOT / "mobile/build.py"):
        subprocess.run([sys.executable, str(script)], cwd=script.parent, check=True)
    desktop.mkdir(parents=True)
    shutil.copytree(ROOT / "mobile/dist", mobile, ignore=shutil.ignore_patterns("compatibility-preview", "phone-check.*"))
    for module in mobile.glob("*.mjs"):
        module.write_text(re.sub(r"\blocalStorage\b", "rehearsalStorage", module.read_text(encoding="utf-8")), encoding="utf-8")
    desktop_html = (ROOT / "preview/dist/index.html").read_text(encoding="utf-8")
    desktop_html = re.sub(r'<link\b[^>]*href="https://fonts\.[^>]+>', '', desktop_html)
    desktop_html = re.sub(r"\blocalStorage\b", "rehearsalStorage", desktop_html)
    (desktop / "index.html").write_text(desktop_html.replace("</body>", '<script type="module" src="desktop.mjs"></script></body>'), encoding="utf-8")
    for path in (mobile / "index.html", desktop / "index.html"):
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("</head>", '<link rel="stylesheet" href="../test.css"><script src="../storage-scope.js"></script></head>'), encoding="utf-8")
    with (mobile / "app.mjs").open("a", encoding="utf-8") as f:
        f.write((HERE / "mobile-bridge.mjs").read_text(encoding="utf-8"))
    shutil.copy(HERE / "desktop.mjs", desktop)
    for name in ("client.mjs", "records.mjs", "workspace.mjs", "storage-scope.js", "test.css"):
        shutil.copy(HERE / name, app)
    worker = (HERE / "sw.js").read_text(encoding="utf-8")
    digest = hashlib.sha256(worker.encode())
    files = []
    for path in sorted(p for p in app.rglob("*") if p.is_file()):
        name = path.relative_to(app).as_posix()
        if path.suffix in {".md", ".pb"}:
            continue  # Static asset documentation is not requested by the app.
        files.append(name)
        digest.update(name.encode() + b"\0" + hashlib.sha256(path.read_bytes()).digest())
    build_id = digest.hexdigest()[:20]
    # Keep the upgrade entry outside the service worker scope to reach older installations.
    entry = (HERE / "open.html").read_text(encoding="utf-8")
    (output / "www/open.html").write_text(entry.replace("BUILD_HASH", build_id), encoding="utf-8")
    (app / "sw.js").write_text(worker.replace("BUILD_HASH", build_id).replace("PRECACHE_FILES", json.dumps(files)), encoding="utf-8")
    shutil.copy(HERE / "server.py", output)
    instructions = (HERE / "README-RU.md").read_text(encoding="utf-8")
    launcher = (HERE / "Start.cmd").read_text(encoding="ascii")
    if fresh:
        start = instructions.index("## Обновление")
        end = instructions.index("## Что передаётся", start)
        setup = (HERE / "README-FRESH-RU.md").read_text(encoding="utf-8").rstrip()
        instructions = instructions[:start] + setup + "\n\n" + instructions[end:]
        launcher = launcher.replace("--port 8443", "--port 8444")
    (output / "README-RU.md").write_text(instructions, encoding="utf-8")
    (output / "Start-PC.cmd").write_bytes(b'@call "%~dp0Start.cmd" 127.0.0.1\r\n')
    (output / "Start.cmd").write_bytes(launcher.replace("\n", "\r\n").encode("ascii"))
    shutil.copy(ROOT / "mobile/tools/serve-phone.py", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--fresh", action="store_true", help="Build a separate installation on port 8444")
    args = parser.parse_args()
    build(args.output.resolve(), fresh=args.fresh)
