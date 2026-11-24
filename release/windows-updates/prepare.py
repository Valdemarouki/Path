"""Build the MSI planner from the checksum-verified release payload."""
import argparse
import hashlib
import json
import re
import struct
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parents[1] / 'desktop'
UPDATER = DESKTOP / 'windows-updates'
BASE = HERE.parent / 'windows-rc22'
BASE_FILES = json.loads((BASE / 'files.json').read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def versions(version):
    match = re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?', version)
    if not match:
        raise ValueError('Invalid release version')
    major, minor, patch = map(int, match.groups()[:3])
    rc = int(match[4]) if match[4] else 999
    if max(major, minor) > 255 or (match[4] and rc >= 999) or patch*1000+rc > 65535:
        raise ValueError('Version cannot be encoded in Windows Installer')
    return {'version':version,'msi':f'{major}.{minor}.{patch*1000+rc}','windows':f'{major}.{minor}.{patch}.{rc}'}


def unpack(blob):
    _, header_size, _, json_size = struct.unpack_from('<4I',blob)
    header = json.loads(blob[16:16+json_size])
    entries = {}
    def walk(files, prefix):
        for name, entry in files.items():
            full = prefix + name
            if 'files' in entry:
                walk(entry['files'], full + '/')
            elif 'link' in entry:
                entries[full] = {'link':entry['link']}
            else:
                start = 8 + header_size + int(entry['offset'])
                content = blob[start:start+entry['size']]
                if entry.get('unpacked') or len(content) != entry['size'] or digest(content) != entry['integrity']['hash']:
                    raise ValueError('Invalid ASAR entry: ' + full)
                entries[full] = content
    walk(header['files'], '')
    return entries


def pack(entries):
    root, payload = {'files':{}}, bytearray()
    block = 4 * 1024 * 1024
    for name, content in sorted(entries.items()):
        parent = root
        *dirs, filename = name.split('/')
        for directory in dirs:
            parent = parent['files'].setdefault(directory,{'files':{}})
        if isinstance(content,dict):
            parent['files'][filename] = content
            continue
        parent['files'][filename] = {'size':len(content),'offset':str(len(payload)), 'integrity':{
            'algorithm':'SHA256','hash':digest(content),'blockSize':block,
            'blocks':[digest(content[i:i+block]) for i in range(0,max(1,len(content)),block)]}}
        payload.extend(content)
    encoded = json.dumps(root,separators=(',',':')).encode()
    length = (4 + len(encoded) + 3) & ~3
    return struct.pack('<4I',4,4+length,length,len(encoded)) + encoded + bytes(length-4-len(encoded)) + payload


def prepare_asar(source, target, version, dependencies):
    blob = source.read_bytes()
    if digest(blob) != BASE_FILES['resources/app.asar']:
        raise ValueError('Expected the exact published RC22 planner')
    entries = unpack(blob)
    package = json.loads(entries['package.json'])
    package['version'] = version
    entries['package.json'] = json.dumps(package, ensure_ascii=False, indent=2).encode()
    old = (DESKTOP/'update-renderer.js').read_text(encoding='utf8').strip().encode()
    html = entries['app/index.html']
    if html.count(old) != 1:
        raise ValueError('The existing update panel was not found in the release')
    entries['app/index.html'] = html.replace(old,(UPDATER/'panel.js').read_bytes())
    entries['update-engine.cjs'] = (UPDATER/'msi-engine.cjs').read_bytes()
    entries['update-service.cjs'] = (DESKTOP/'update-service.cjs').read_bytes()
    for name in ['engine.cjs','release.cjs','sigstore-root.json']:
        entries['windows-updates/'+name] = (UPDATER/name).read_bytes()
    for name, expected in json.loads((UPDATER/'package.json').read_text())['dependencies'].items():
        dep = dependencies/name
        if json.loads((dep/'package.json').read_text())['version'] != expected:
            raise ValueError('Unexpected verifier dependency: '+name)
        for item in sorted(dep.rglob('*')):
            if item.is_file() and (item.suffix in ['.js','.json'] or item.name.startswith('LICENSE')):
                entries['node_modules/'+name+'/'+item.relative_to(dep).as_posix()] = item.read_bytes()
    output = pack(entries)
    if unpack(output) != entries: raise ValueError('ASAR round-trip failed')
    target.write_bytes(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workspace', type=Path)
    args = parser.parse_args()
    work = args.workspace.resolve()
    runtime = work/'runtime'
    files = {p.relative_to(runtime).as_posix():digest(p.read_bytes()) for p in runtime.rglob('*') if p.is_file()}
    if files != BASE_FILES: raise ValueError('Base runtime differs from RC22')
    release = versions((HERE/'version.txt').read_text().strip())
    asar = runtime/'resources/app.asar'
    prepare_asar(asar, asar, release['version'], UPDATER/'node_modules')
    exe = runtime/'Path.exe'
    editor = work/'rcedit-x64.exe'
    if digest(editor.read_bytes()) != '3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a':
        raise ValueError('Unexpected resource editor')
    subprocess.run([str(editor),str(exe),'--set-file-version',release['windows'],'--set-product-version',release['windows']],check=True)
    config = runtime/'resources/app-update.yml'
    config.write_text('provider: custom\nchannel: path-windows-updates\n',encoding='ascii')
    for p in (asar, exe, config): files[p.relative_to(runtime).as_posix()] = digest(p.read_bytes())
    (work/'update-build.json').write_text(json.dumps({**release,'files':files}),encoding='utf8')
