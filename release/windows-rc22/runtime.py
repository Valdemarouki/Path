"""Recreate the versioned Windows distribution and verify every runtime file."""
import argparse
import hashlib
import json
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ELECTRON = 'https://github.com/electron/electron/releases/download/v45.1.0/electron-v45.1.0-win32-x64.zip'
ZIP_SHA256 = '55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2'
ELECTRON_EXE_SHA256 = 'c579acaab64b1c456bda1693cdf1a2ec7e4de7738b0e2d1b6349d60e8087143c'
RCEDIT_URL = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe'
RCEDIT_SHA256 = '3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a'
PAYLOAD_SHA256 = 'f9d5e2eb33524b2eedbc81ccac12a80cf10fabbc575b07cb7b5c584508d58d5f'

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def brand_executable(program, icon, editor):
    if digest(program)!=ELECTRON_EXE_SHA256 or digest(editor)!=RCEDIT_SHA256:
        raise ValueError('Unexpected upstream executable or resource editor.')
    subprocess.run([str(editor),str(program),'--set-icon',str(icon),
        '--set-version-string','ProductName','Path','--set-version-string','FileDescription','Path',
        '--set-version-string','OriginalFilename','Path.exe','--set-version-string','InternalName','Path',
        '--set-version-string','CompanyName','Path','--set-file-version','2.0.0.22',
        '--set-product-version','2.0.0.22'],check=True)

def prepare(workspace, existing, editor):
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
    if editor is None:
        editor=workspace/'rcedit-x64.exe'
        urllib.request.urlretrieve(RCEDIT_URL,editor)
    brand_executable(runtime/'Path.exe',assets/'path.ico',editor)
    actual = {p.relative_to(runtime).as_posix():digest(p) for p in runtime.rglob('*') if p.is_file()}
    if actual != expected:
        raise ValueError('Runtime differences: '+str([k for k in actual.keys()|expected.keys() if actual.get(k)!=expected.get(k)]))
    print('Verified all',len(expected),'distribution files.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workspace',type=Path)
    parser.add_argument('--existing',type=Path)
    parser.add_argument('--rcedit',type=Path)
    args = parser.parse_args()
    prepare(args.workspace.resolve(),args.existing,args.rcedit)
