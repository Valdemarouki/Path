"""Dependency-free static build. Writes only mobile/dist; never runs desktop code."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
target = root / 'dist'
target.mkdir(exist_ok=True)
for name in ('index.html', 'styles.css', 'navigation.css', 'navigation.mjs', 'habit-icon.mjs', 'app.mjs', 'model.mjs', 'i18n.mjs', 'typography.css', 'tasks.css', 'calendar-cards.css', 'calendar-model.mjs', 'event-editor.mjs', 'date-utils.mjs', 'task-selectors.mjs', 'alpha-model.mjs', 'alpha-ui.mjs', 'alpha-i18n.mjs', 'alpha.css', 'desktop-adapter.mjs'):
    shutil.copy2(root / name, target / name)
shutil.copytree(root / 'assets', target / 'assets', dirs_exist_ok=True)
for name in ('calendar-completion.mjs','calendar-completion.css','calendar-impact.mjs','actions.mjs','actions.css','numeric-values.mjs','numeric-picker.mjs','numeric-fields.mjs','numeric-picker.css','desktop-inspector.mjs','desktop-test-repository.mjs','desktop-test-controls.mjs','desktop-test-i18n.mjs','desktop-test.css','phone-viewport.mjs','build-info.mjs','phone-check.html','phone-check.mjs','sport-model.mjs','sport-ui.mjs','sport-i18n.mjs','sport.css'):
    shutil.copy2(root / name, target / name)

# The authoritative pure Sport modules live in the existing domain directory.
# Source imports resolve there for Node checks; the static build is self-contained.
(target / 'domain').mkdir(exist_ok=True)
for name in ('sport-catalog.js','sport-body-map.js','sport-core.js'):
    shutil.copy2(root.parent / 'domain' / name, target / 'domain' / name)
for module in target.glob('*.mjs'):
    source=module.read_text()
    module.write_text(source.replace("'../domain/", "'./domain/").replace('"../domain/', '"./domain/'))
shutil.copytree(root.parent / 'assets' / 'sport', target / 'assets' / 'sport', dirs_exist_ok=True)

shutil.copytree(root / 'typography-preview' / 'fonts', target / 'fonts', dirs_exist_ok=True)
shutil.copytree(root / 'compatibility-preview', target / 'compatibility-preview', dirs_exist_ok=True)
print('Built mobile/dist (static, local assets only).')
