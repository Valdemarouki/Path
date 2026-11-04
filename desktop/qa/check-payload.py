"""Verify the ZIP extracted from the final NSIS EXE, not only staging files.
Usage: python3 qa/check-payload.py /path/to/7za installer.exe unpacked-directory
"""
import hashlib
import pathlib
import subprocess
import sys
import tempfile
import zipfile

seven, installer, unpacked = sys.argv[1:]
root = pathlib.Path(unpacked)
with tempfile.TemporaryDirectory(prefix='path-payload-') as tmp:
    subprocess.run([seven, 'x', installer, '-o'+tmp, '$PLUGINSDIR/app-64.zip', '-y'], check=True, stdout=subprocess.DEVNULL)
    payload = pathlib.Path(tmp)/'$PLUGINSDIR/app-64.zip'
    with zipfile.ZipFile(payload) as z:
        assert z.testzip() is None, 'ZIP CRC failure'
        names = {n for n in z.namelist() if not n.endswith('/')}
        expected = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and not any(part.startswith('.') for part in p.relative_to(root).parts)}
        assert names == expected, ('Payload members differ', names ^ expected)
        for name in names:
            assert hashlib.sha256(z.read(name)).digest() == hashlib.sha256((root/name).read_bytes()).digest(), name
        assert {'Path 2.0.exe', 'resources/app.asar', 'icudtl.dat'} <= names
        print('PASS final installer ZIP: all CRCs and all', len(names), 'files match staging SHA-256; EXE and app.asar present')
