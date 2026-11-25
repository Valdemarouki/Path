"""Build the MSI planner from the checksum-verified release payload."""
import argparse
import base64
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
    # Desktop authorizes its inline scripts by hash. Update only the hash of
    # the script containing the panel, using the browser's normalized text.
    def script_hash(body):
        normalized = body.replace(b'\r\n',b'\n').replace(b'\r',b'\n')
        return b"'sha256-" + base64.b64encode(hashlib.sha256(normalized).digest()) + b"'"
    host, = [m[1] for m in re.finditer(br'<script>(.*?)</script>',html,re.S) if old in m[1]]
    panel = (UPDATER/'panel.js').read_text(encoding='utf8').encode()
    updated = host.replace(old,panel)
    old_hash = script_hash(host)
    policy, = re.findall(br'<meta http-equiv="Content-Security-Policy" content="[^"]+">',html)
    if old_hash not in policy:
        raise ValueError('The signed baseline script is missing from its desktop CSP')
    new_policy = policy.replace(old_hash,script_hash(updated))
    html = html.replace(host,updated,1).replace(policy,new_policy,1)
    if html.count(b'</head>') != 1:
        raise ValueError('Expected one desktop document head')
    css = (UPDATER/'shortcut.css').read_bytes()
    entries['app/index.html'] = html.replace(b'</head>', b'<style>' + css + b'</style></head>')
    # The public runtime includes newer account/sync handlers than this checkout.
    # Import only the update preference and periodic check from the desktop host.
    main = entries['main.cjs'].decode('utf8').splitlines(keepends=True)
    source_main = (DESKTOP/'main.cjs').read_text(encoding='utf8').splitlines(keepends=True)
    for prefix in ('function updatePreference()', '   const check=()=>'):
        index, = [i for i,line in enumerate(main) if line.startswith(prefix)]
        main[index], = [line for line in source_main if line.startswith(prefix)]
    entries['main.cjs'] = ''.join(main).encode()
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
    # Rekor and Fulcio use ECDSA P-256 / SHA-256. Stock Node chooses SHA-256
    # implicitly for EC keys. Electron's BoringSSL requires the digest by name.
    # Keep explicit certificate algorithms and Ed25519's digest-less mode intact.
    crypto_module = 'node_modules/@sigstore/core/dist/crypto.js'
    call = b'return crypto_1.default.verify(algorithm, data, key, signature);'
    if entries[crypto_module].count(call) != 1:
        raise ValueError('Review the Electron digest adapter for this verifier version')
    entries[crypto_module] = entries[crypto_module].replace(call,
        b"if (algorithm == null && key.asymmetricKeyType === 'ec') algorithm = 'sha256';\n        " + call)
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
