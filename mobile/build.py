"""Dependency-free static build. Writes only mobile/dist; never runs desktop code."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
target = root / 'dist'
target.mkdir(exist_ok=True)
for name in ('index.html', 'styles.css', 'navigation.css', 'navigation.mjs', 'app.mjs', 'model.mjs', 'i18n.mjs', 'typography.css', 'tasks.css', 'calendar-cards.css', 'calendar-model.mjs', 'event-editor.mjs', 'date-utils.mjs', 'task-selectors.mjs', 'alpha-model.mjs', 'desktop-adapter.mjs'):
    shutil.copy2(root / name, target / name)
shutil.copytree(root / 'assets', target / 'assets', dirs_exist_ok=True)
print('Built mobile/dist (static, local assets only).')

shutil.copytree(root / 'typography-preview' / 'fonts', target / 'fonts', dirs_exist_ok=True)
