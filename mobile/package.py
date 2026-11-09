"""Export committed mobile source/docs and the local branch; never contacts remotes."""
from pathlib import Path
import argparse
import hashlib
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, help='Export outside the repository; default: sibling path-mobile-deliveries/<HEAD>')
args = parser.parse_args()

root = Path(__file__).resolve().parent.parent
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=root, text=True).strip()
if branch != 'feature/path-mobile-alpha':
    raise SystemExit('Run only on feature/path-mobile-alpha')
# Include committed files only; uncommitted edits would not be backed up.
status = subprocess.check_output(['git', 'status', '--porcelain', '--', 'mobile', 'docs/mobile'], cwd=root, text=True)
if status:
    raise SystemExit('Commit the mobile/doc changes first; export aborted to avoid an incomplete backup')
head = subprocess.check_output(['git', 'rev-parse', '--short=12', 'HEAD'], cwd=root, text=True).strip()
out = (args.output_dir or root.parent / 'path-mobile-deliveries' / head).resolve()
if out == root or root in out.parents:
    raise SystemExit('Choose an export directory outside the repository')
out.mkdir(parents=True, exist_ok=True)
source = out / 'path-mobile-alpha-source.tar.gz'
bundle = out / 'path-mobile-alpha.bundle'
subprocess.run(['git', 'archive', '--format=tar.gz', '--prefix=path-mobile-alpha/', '--output=' + str(source), 'HEAD', 'mobile', 'docs/mobile'], cwd=root, check=True)
subprocess.run(['git', 'bundle', 'create', str(bundle), branch], cwd=root, check=True)
subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=root, check=True)
manifest = ''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n' for p in (source, bundle))
(out / 'SHA256SUMS').write_text(manifest)
print(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip())
print(manifest, end='')
print('Local exports:', out)
print('These files do not establish an externally stored backup or verified chat download.')
