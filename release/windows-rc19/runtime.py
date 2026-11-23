"""Recreate the versioned Windows distribution and verify every runtime file."""
import argparse
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ELECTRON = 'https://github.com/electron/electron/releases/download/v45.1.0/electron-v45.1.0-win32-x64.zip'
ZIP_SHA256 = '55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2'
PAYLOAD_SHA256 = 'c6aee1d7896941cec016bfab9b641387f58396752032b4cf0bf73cbf71126199'

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def prepare(workspace, existing):
    runtime, assets = workspace/'runtime', workspace/'assets'
    runtime.mkdir(parents=True)
    assets.mkdir()
    expected = json.loads((HERE/'files.json').read_text())
    payload = HERE/'payload.zip'
    if digest(payload) != PAYLOAD_SHA256:
        raise ValueError('Incorrect planner payload')
    with zipfile.ZipFile(payload) as archive:
        assert set(archive.namelist()) == {'app.asar','app-update.yml','path.ico','installer.ico'}
        archive.extractall(assets)
    if existing:
        for name in expected:
            if name.startswith('resources/'):
                continue
            target = runtime/name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(existing/name, target)
    else:
        zipped = workspace/'electron.zip'
        urllib.request.urlretrieve(ELECTRON, zipped)
        if digest(zipped) != ZIP_SHA256:
            raise ValueError('Official Electron archive checksum differs')
        with zipfile.ZipFile(zipped) as archive:
            archive.extractall(runtime)
        (runtime/'electron.exe').rename(runtime/'Path.exe')
        (runtime/'resources/default_app.asar').unlink()
    (runtime/'resources').mkdir(exist_ok=True)
    for name in ('app.asar','app-update.yml'):
        shutil.copyfile(assets/name, runtime/'resources'/name)
    actual = {p.relative_to(runtime).as_posix():digest(p) for p in runtime.rglob('*') if p.is_file()}
    if actual != expected:
        raise ValueError('Runtime differences: '+str([k for k in actual.keys()|expected.keys() if actual.get(k)!=expected.get(k)]))
    print('Verified all',len(expected),'distribution files.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workspace',type=Path)
    parser.add_argument('--existing',type=Path)
    args = parser.parse_args()
    prepare(args.workspace.resolve(),args.existing)
