"""Dependency-free static build. Writes only mobile/dist; never runs desktop code."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
target = root / 'dist'
target.mkdir(exist_ok=True)
for name in ('index.html', 'styles.css', 'navigation.css', 'navigation.mjs', 'habit-icon.mjs', 'app.mjs', 'model.mjs', 'i18n.mjs', 'typography.css', 'tasks.css', 'calendar-cards.css', 'calendar-model.mjs', 'event-editor.mjs', 'date-utils.mjs', 'task-selectors.mjs', 'alpha-model.mjs', 'alpha-ui.mjs', 'alpha-i18n.mjs', 'alpha.css', 'desktop-adapter.mjs'):
    shutil.copy2(root / name, target / name)
shutil.copytree(root / 'assets', target / 'assets', dirs_exist_ok=True)
for name in ('calendar-completion.mjs','calendar-completion.css','calendar-impact.mjs','actions.mjs','actions.css','numeric-values.mjs','numeric-picker.mjs','numeric-fields.mjs','numeric-picker.css','desktop-inspector.mjs','desktop-test-repository.mjs','desktop-test-controls.mjs','desktop-test-i18n.mjs','desktop-test.css','phone-viewport.mjs','build-info.mjs','phone-check.html','phone-check.mjs'):
    shutil.copy2(root / name, target / name)
print('Built mobile/dist (static, local assets only).')

shutil.copytree(root / 'typography-preview' / 'fonts', target / 'fonts', dirs_exist_ok=True)
shutil.copytree(root / 'compatibility-preview', target / 'compatibility-preview', dirs_exist_ok=True)
