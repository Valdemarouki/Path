"""Build an isolated font experiment; production sources are never rewritten."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
mobile = root.parent
target = root / 'dist'
target.mkdir(exist_ok=True)
for name in ('styles.css', 'navigation.css', 'navigation.mjs', 'app.mjs', 'i18n.mjs', 'typography.css', 'tasks.css', 'calendar-cards.css', 'calendar-model.mjs', 'event-editor.mjs', 'date-utils.mjs', 'task-selectors.mjs', 'alpha-model.mjs', 'desktop-adapter.mjs'):
    shutil.copy2(mobile / name, target / name)
model = (mobile / 'model.mjs').read_text()
assert "'path-mobile-alpha-v1'" in model
(target / 'model.mjs').write_text(model.replace("'path-mobile-alpha-v1'", "'path-mobile-manrope-preview-v1'", 1))
html = (mobile / 'index.html').read_text()
assert html.count('</head>') == 1
html = html.replace('</head>', '<link rel="preload" href="fonts/Manrope-Variable.ttf" as="font" type="font/ttf" crossorigin>\n<link rel="stylesheet" href="manrope-preview.css">\n<script type="module" src="preview.mjs"></script>\n</head>')
(target / 'index.html').write_text(html)
shutil.copytree(mobile / 'assets', target / 'assets', dirs_exist_ok=True)
shutil.copytree(root / 'fonts', target / 'fonts', dirs_exist_ok=True)
for name in ('manrope-preview.css', 'preview.mjs'):
    shutil.copy2(root / name, target / name)
print('Built mobile/typography-preview/dist; production files and storage key unchanged.')
