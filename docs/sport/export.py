"""Export the committed full Sport source, local Git history and ready static apps."""
from pathlib import Path
import argparse
import hashlib
import html
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path)
args = parser.parse_args()


def git(*arguments):
    return subprocess.check_output(['git', *arguments], cwd=root, text=True).strip()


branch = git('branch', '--show-current')
if branch != 'feature/path-mobile-alpha':
    raise SystemExit('Export only from the authorized isolated feature branch')
if git('status', '--porcelain'):
    raise SystemExit('Commit reviewed changes first; source export must match ready files')
head = git('rev-parse', 'HEAD')
baseline = '7d0fe19be5f7807505adc99afd5b630e04e8df0f'
commits = [dict(zip(('sha','subject'), line.split('\t', 1)))
           for line in git('log','--reverse','--format=%H\t%s',baseline+'..'+head).splitlines()]
out = (args.output_dir or root.parent / 'path-mobile-deliveries' / ('sport-' + head[:12])).resolve()
if out == root or root in out.parents:
    raise SystemExit('Delivery directory must be outside the repository')
out.mkdir(parents=True, exist_ok=True)

for script in ('build.py', 'mobile/build.py'):
    subprocess.run(['python3', script], cwd=root, check=True)

evidence_inputs = {
    'desktopHTML': (root / 'preview/dist/index.html', root / 'docs/sport/browser/desktop/report.json'),
    'mobileSportUI': (root / 'mobile/dist/sport-ui.mjs', root / 'docs/sport/browser/mobile/verification.json'),
}
verified_inputs = {}
for key, (file, report) in evidence_inputs.items():
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    if json.loads(report.read_text())['inputSHA256'] != digest:
        raise SystemExit('Acceptance evidence is stale: ' + key)
    verified_inputs[key] = digest

source = out / 'path-sport-alpha-source.tar.gz'
bundle = out / 'path-sport-alpha.bundle'
subprocess.run(['git', 'archive', '--format=tar.gz', '--prefix=path-sport/',
                '--output=' + str(source), head], cwd=root, check=True)
subprocess.run(['git', 'bundle', 'create', str(bundle), branch], cwd=root, check=True)
subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=root, check=True)

guide = (root / 'docs/sport/LOCAL_TEST_RU.md').read_text()
build = ('Path Sport local test\nBuild: path-sport-2026-11-11-a1\n'
         'Branch: ' + branch + '\nHEAD: ' + head + '\n'
         'Desktop browser renderer and mobile alpha; no installer, sync or publication.\n')
payload = {}
for file in sorted((root / 'mobile/dist').rglob('*')):
    if file.is_file():
        payload['Path-Mobile/' + file.relative_to(root / 'mobile/dist').as_posix()] = file.read_bytes()
payload['Path-Desktop/index.html'] = (root / 'preview/dist/index.html').read_bytes()
for file in sorted((root / 'assets/sport').rglob('*')):
    if file.is_file():
        payload['Path-Desktop/assets/sport/' + file.relative_to(root / 'assets/sport').as_posix()] = file.read_bytes()
payload['Tools/serve-phone.py'] = (root / 'mobile/tools/serve-phone.py').read_bytes()
payload['START-HERE.txt'] = guide.encode()
payload['START-HERE.html'] = ('<!doctype html><html lang="ru"><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    '<title>Path Sport — локальный запуск</title><style>body{margin:24px auto;'
    'padding:0 20px;max-width:900px;font:16px/1.65 system-ui;background:#111;color:#eee}'
    'pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><body><pre>'
    + html.escape(guide) + '</pre></body></html>').encode()
for prefix in ('', 'Path-Mobile/', 'Path-Desktop/'):
    payload[prefix + 'BUILD.txt'] = build.encode()
payload['LICENSES/Manrope-OFL.txt'] = (root / 'mobile/typography-preview/fonts/OFL.txt').read_bytes()
payload['RUNTIME_SHA256SUMS'] = ''.join(hashlib.sha256(data).hexdigest() + '  ' + name + '\n'
    for name, data in sorted(payload.items())).encode()
archive = out / 'path-sport-local-test.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(payload.items()):
        z.writestr(name, data)
with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None:
        raise SystemExit('Delivery ZIP CRC failure')
    for name, data in payload.items():
        if z.read(name) != data:
            raise SystemExit('Delivery member mismatch: ' + name)

artifacts = [archive, source, bundle]
manifest = ''.join(hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name + '\n'
                   for file in artifacts)
(out / 'SHA256SUMS').write_text(manifest)
(out / 'DELIVERY.json').write_text(json.dumps({
    'branch': branch, 'head': head, 'build': 'path-sport-2026-11-11-a1',
    'baseline': baseline, 'commits': commits, 'gitStatus': git('status','--porcelain'),
    'acceptanceInputSHA256': verified_inputs,
    'sourceScope': 'Full tracked repository, including desktop, mobile, domain and assets',
    'zipCrcAndMemberContentsVerified': True, 'restorationSmoke': 'pending',
    'physicalIPhoneTested': False, 'installedWindowsAppTested': False,
    'newListeners': False, 'published': False,
    'artifacts': [{'name': file.name, 'bytes': file.stat().st_size,
                   'sha256': hashlib.sha256(file.read_bytes()).hexdigest()} for file in artifacts],
    'backup': 'Local environment artifacts; external preservation depends on copying them elsewhere'
}, indent=2) + '\n')
print(head)
print(manifest, end='')
print('Local delivery directory:', out)
