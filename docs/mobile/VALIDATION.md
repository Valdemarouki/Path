> Current Calendar functionality and schema 4: [Functional Polish](calendar-polish/README.md). Earlier milestone descriptions below are historical.

> Latest Calendar functionality and schema 3: [compatibility stage](compatibility/README.md). Earlier milestone descriptions below are historical.

> Latest functional-stage results: [tasks/README.md](tasks/README.md). Earlier results below describe prior milestones.

# Alpha 01 validation — 8 November 2026

Implementation commit: `bf0f769` on local `feature/path-mobile-alpha`.
Baseline: `2f4d73bfa18d2a04c1d7520116b0d9bd8d5d173c`.
Environment: isolated Linux cloud machine, Node.js 24.22.1, Python 3.12.14,
Chromium via the preinstalled Playwright. No installation or external requests
were needed. App requests were restricted to the loopback static server.

## Results

| Check | Result |
| --- | --- |
| `python3 mobile/build.py` | PASS, static output in ignored `mobile/dist` |
| `TZ=Europe/Warsaw node --test mobile/tests/model.test.mjs` | 12 passed; 0 failed, skipped or disabled |
| `node mobile/tests/browser.cjs` | 55 browser cases passed; no page errors or external requests |
| Existing tracked desktop/root files | No differences from the baseline |
| Existing philosopher resource | Mobile copy byte-identical to the original |

Model coverage: stable IDs, task create/toggle/reload, dated habit history and
weekday eligibility, local-day arithmetic across DST/leap boundaries, event
sorting and cross-midnight overlap, locale persistence without title rewriting,
quota errors/rollback, malformed/newer snapshots and stale-tab writes. Existing
desktop storage keys remain untouched in the storage test double.

Browser coverage: English default with Russian OS locale; task create/complete
and habit mark survive reload; Calendar day selection and Quick Add on the
selected day; EN/RU/ES choice survives reload; keyboard entry, dialog focus and
Escape return; localized required-field error; failed writes retain the input
and permit retry; corrupt data is not replaced; midnight updates Today behind
the modal without changing its explicit date or input; second-tab change warning.

Responsive matrix: Today, Calendar, Sport and More at widths **320, 390, 844**
in EN/RU/ES (36 combinations), including 844×390 landscape. Checked document
overflow and navigation bounds. Reduced motion at 320 px disables both route
and checkmark animations. Enlarged typography was simulated with CSS (20/24 px)
and checked for horizontal overflow; this does not replace actual OS font scaling.
Task completion was checked to leave the next section at the same vertical
position. Visual review covered Today, the habit/portrait area and More.

## Screenshots

Screenshots use a disposable mobile Chromium context with synthetic fixtures;
time is fixed at 8 November 2026, 12:30 Europe/Warsaw. The Quick Add capture
also exercises simulated midnight. Finite animations are settled for capture.

- `screenshots/today-en-390.png` — initial Today.
- `screenshots/today-en-habits-390.png` — scrolled habits and philosopher.
- `screenshots/calendar-en-390.png` — day agenda after synthetic completion.
- `screenshots/more-en-390.png` — unavailable destinations honestly labelled.
- `screenshots/today-ru-390.png` — persisted Russian interface.
- `screenshots/today-es-390.png` — persisted Spanish interface.
- `screenshots/today-ru-320-reduced-motion.png` — narrow Russian view.
- `screenshots/quick-add-ru-390.png` — retained input at midnight.

## Not verified / next decisions

- Native iOS/Android, Safari/WebKit/Firefox, real touch devices, physical keyboard
  occlusion and safe-area behavior on actual phones were not tested.
- No installable native/PWA package, service worker or offline cold-start promise.
  The local server must remain available for loading/reloading the app.
- No desktop regression suite was rerun: desktop files were not changed and this
  app does not import desktop modules. Desktop compatibility is a semantic design
  constraint, not a verified interchange format.
- Multi-tab conflict detection has a documented simultaneous-write race; stronger
  transactions and a migration strategy are needed before valuable data is used.
- A bundled, licensed display font, native accessibility/font scaling review,
  task editing/history, habit management and a separately approved data bridge
  are follow-ups. Accounts/sync and full section implementation are outside scope.
- Local commits and files are not external backups. No republish, deployment or
  GitHub write was performed. Download the exported archive/bundle to preserve
  an independent copy; restoration in a new cloud task remains unverified.
