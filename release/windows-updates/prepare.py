"""Build the MSI planner from the checksum-verified release payload."""
import argparse
import base64
import hashlib
import json
import re
import struct
import subprocess
from pathlib import Path
from canvas_renderer import apply_canvas

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
    html = entries['app/index.html']
    # The verified release has newer sync/conflict handlers than the development
    # tree. Replace the two presentation modules, retaining those shipped handlers.
    old_panel_start = b"(()=>{\n const api=window.pathDesktop?.updates;"
    account_start = b'/* Desktop-only bridge. No passwords or tokens enter the renderer. */'
    def script_hash(body):
        normalized = body.replace(b'\r\n',b'\n').replace(b'\r',b'\n')
        return b"'sha256-" + base64.b64encode(hashlib.sha256(normalized).digest()) + b"'"
    host, = [m[1] for m in re.finditer(br'<script>(.*?)</script>',html,re.S) if account_start in m[1]]
    normalized = host.replace(b'\r\n',b'\n')
    prefix, old_ui = normalized.split(old_panel_start)
    old_panel, old_account = old_ui.split(account_start)
    if digest((old_panel_start + old_panel).strip()) != 'cc6c93aa0e02e8addff2474a9c2880d933d125eeecd6b974084de073d98ec6cf' or digest((account_start + old_account).strip()) != '16178a4601a3b72f78d055d237b526bd9f273a4fdc1d498b3944c6b0e4393948':
        raise ValueError('Unexpected profile or updates module in the RC22 baseline')
    old_receive = b'return {paint:render,receive:response=>{result=response;'
    new_receive = b'return {paint:render,needsReview:()=>profile===getState().profileId&&!!(result.conflict||result.recovery||result.needsBootstrapChoice||result.activationConflict),receive:response=>{profile=getState().profileId;result=response;'
    if prefix.count(old_receive) != 2:
        raise ValueError('Review the full and expanded sync presentation hooks')
    prefix = prefix.replace(old_receive,new_receive)
    updated = b'\n'.join([prefix, (UPDATER/'panel.js').read_bytes(), (DESKTOP/'profile-panel.js').read_bytes(), (DESKTOP/'account-renderer.js').read_bytes()])
    old_hash = script_hash(host)
    policy, = re.findall(br'<meta http-equiv="Content-Security-Policy" content="[^"]+">',html)
    if old_hash not in policy:
        raise ValueError('The signed baseline script is missing from its desktop CSP')
    original_scripts = re.findall(br'<script>(.*?)</script>', html, re.S)
    html = apply_canvas(html.replace(host, updated, 1).decode('utf8').replace('\r\n','\n')).encode()
    collab = DESKTOP.parent / 'collaboration'
    begin = html.index(b'// Shared documents are edited outside the private checkpoint')
    mount_start = html.index(b'PathSharedLibrary.mount({rpc:', begin)
    finish = html.index(b'\n', mount_start)
    # Only replace the old collaboration module and mount call.
    if html[begin:finish].count(b'PathSharedLibrary.mount(') != 1 or not html[begin:finish].rstrip().endswith(b'});'):
        raise ValueError('Review the signed baseline sharing hook')
    sharing_css = (collab / 'sharing.css').read_text()
    mount = (collab / 'mount.js').read_text().replace("'__PATH_SHARING_STYLES__'", json.dumps(sharing_css))
    html = html[:begin] + (collab / 'canvas-cursors.js').read_bytes() + b'\n' + (collab / 'shared-library.js').read_bytes() + b'\n' + mount.encode() + html[finish:]
    mark_css = sharing_css[sharing_css.index('.path-shared-mark{'):sharing_css.index('.item .path-shared-mark')]
    html = html.replace(b'</head>', b'<style>' + mark_css.encode() + b'</style></head>', 1)
    html = html.replace(b'<script>', b'<script>\n' + (DESKTOP/'calendar-clock.js').read_bytes() + b'\n', 1)
    new_scripts = re.findall(br'<script>(.*?)</script>',html,re.S)
    if len(new_scripts) != len(original_scripts):
        raise ValueError('Unexpected change in desktop script count')
    if policy.count(b'connect-src https:;') != 1:
        raise ValueError('Review desktop cursor connection policy')
    new_policy = policy.replace(b'connect-src https:;', b'connect-src https: wss://path-mobile-stfqgdvl.waldek-path.workers.dev;')
    for before, after in zip(original_scripts, new_scripts):
        previous_hash = script_hash(before)
        if new_policy.count(previous_hash) != 1:
            raise ValueError('Desktop script hash is missing from the original CSP')
        new_policy = new_policy.replace(previous_hash, script_hash(after))
    html = html.replace(policy,new_policy,1)
    if html.count(b'</head>') != 1:
        raise ValueError('Expected one desktop document head')
    css = (UPDATER/'shortcut.css').read_bytes() + (DESKTOP/'profile-panel.css').read_bytes() + (DESKTOP/'calendar-clock.css').read_bytes()
    entries['app/index.html'] = html.replace(b'</head>', b'<style>' + css + b'</style></head>')
    # The public runtime includes newer account/sync handlers than this checkout.
    # Import only the update preference and periodic check from the desktop host.
    main = entries['main.cjs'].decode('utf8').splitlines(keepends=True)
    source_main = (DESKTOP/'main.cjs').read_text(encoding='utf8').splitlines(keepends=True)
    for prefix in ('function updatePreference()', '   const check=()=>'):
        index, = [i for i,line in enumerate(main) if line.startswith(prefix)]
        main[index], = [line for line in source_main if line.startswith(prefix)]
    packed_main = ''.join(main)
    first = packed_main.index("ipcMain.handle('path:sharing'")
    last = packed_main.index("ipcMain.handle('path:account-status'", first)
    current_main = ''.join(source_main)
    new_handler = current_main[current_main.index("ipcMain.handle('path:sharing'"):current_main.index("ipcMain.handle('path:account-status'")]
    packed_main = packed_main[:first] + new_handler + packed_main[last:]
    packed_main = packed_main.replace("target.kind==='account'&&accountConfig.sharing?.enabled", "target.kind==='account'&&accountConfig.enabled")
    entries['main.cjs'] = packed_main.encode()
    entries['cloud-sync/sharing-transport.cjs'] = (DESKTOP.parent / 'cloud-sync/sharing-transport.cjs').read_bytes()
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
