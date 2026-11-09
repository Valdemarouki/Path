# Calendar compatibility stage

Baseline: /workspace/Path, feature/path-mobile-alpha, e5ec8dc9c03d6f83c7059710fccfbb2048eead5b, clean working tree. Desktop source was inspected read-only; existing user data, accounts and desktop runtime were not used.

- [Full section-by-section audit and compatibility table](AUDIT.md)
- [Future offline/sync proposal — not implemented](SYNC_PROPOSAL.md)
- [Complete changed-file manifest](FILES.txt)

## Implemented Calendar behavior

Calendar has a New event action and opens an existing event by tap, Enter or Space. A compact native modal sheet has explicit Save, title/date, start + elapsed duration, calculated localized end, the event's visible time zone, six desktop type values, four importance values and completion. Notes/location, repeated-clock choice and optional custom icon are under More details. The display hierarchy is title → time → type/importance; type glyphs are distinct and a separate custom icon never replaces the type. The approved opaque graphite/noise material remains; the glass navigation implementation and its animations are untouched.

Supported standalone fields: id (immutable), title, notes, location, date, hour, duration, start_at, end_at, tzid (preserved, not a free-form editable zone), fold earlier/later, type busy/workout/routine/deadline/focus/free_time, importance none/low/medium/high, done, eventIcon calendar/book/focus/sport/sun, protected. Save updates the same object, retaining unknown fields. Newly created events have UUIDs; no desktop ID is reassigned. Locale applies to UI and calculated/date/time labels, never user-entered names/descriptions. Native picker presentation follows the browser/OS locale.

New/retimed intervals follow desktop's 15-minute grid, up to seven days. Legacy mobile times/5-minute durations are not silently rounded on title/notes edits. Time conversion is a narrow mobile adaptation of the inspected timezone.js candidate algorithm: IANA zone, explicit fold choice, elapsed duration, rejection of nonexistent local times. Day list uses instant overlap in device zone; editor uses the event's zone. Midnight-crossing events appear on both applicable days.

Deadline is date-only with duration 0 and is excluded from Upcoming. Its completion is displayed/preserved but not edited in the standalone mobile deadline form. Free Time is always neutral priority and incomplete; its soft/protected reservation is shown, and protected Free Time blocks overlapping reservations. Overlap requires an explicit acknowledgement, never an automatic date shift. Open-slot suggestions are not implemented.

Recurrences/exceptions, any linked task/project/workout/reference/snapshot, unknown type/importance/icon/fold, unsupported zones or over-limit note/location values open read-only. Preserved-details disclosure includes original values, IDs, snapshot fields and matching eventSeries metadata/cancelled dates. The root eventSeries and all unknown collections remain untouched. If a linked task is already present in retained task/project data, its importance is used for display as on desktop; if the source is absent, the UI states that desktop is needed instead of pretending to know its priority. No linked object, series or actual workout is partially mutated.

Reminders are displayed with their original reminderMinutes, explicitly labeled as desktop reminders without delivery on mobile. No notification permission or scheduler is requested. Recurrence creation/scope editing, linked completion, mobile event deletion/Undo, full desktop import and cloud sync are not implemented in this stage. Other sections remain at their previous capabilities.

## Persistence/versioning

Mobile schema is now version 3, in the same separate path-mobile-alpha-v1 namespace. This names the storage namespace, not schema version. v1 adds the prior mainTasks reference then v2→v3 only advances the schema marker in a clone. Existing serialized bytes remain untouched until successful user save. No fixture is re-seeded over an existing document. Older code should fail closed on version 3; downgrading without a separate export is unsupported.

The pre-existing Web Locks + serialized baseline comparison protect every UI commit. Success/close happens only after storage write. On quota failure all form fields remain; retry is available. Stale tabs preserve the draft and require explicit Load latest data before retry; a deleted event is not recreated by editing a stale ID. Unknown fields survive patches and JSON export. This is a mobile contract, not a validated importer for the entire desktop root: expanded Habits, Notes, Sport and permissions still require audited adapters.

## Tests and evidence

Build: `python3 mobile/build.py` — PASS.

| Suite | Result |
|---|---|
| Existing task/habit + new Calendar model tests | 26 PASS |
| Calendar editor, 320/390/430 × EN/RU/ES, reduced motion | 72 PASS |
| Six type icons, deadline, Free Time, overlap, stale tab, linked series | 6 PASS |
| Four importance levels, 320/390/430 × EN/RU/ES | 9 PASS |
| Existing Calendar card regression, updated to expect the real editor | 9 PASS |
| Existing general browser regression | 55 PASS |
| Existing navigation transformation regression | 21 PASS |

Model tests include v1/v2 lazy migration, unknown-field/root preservation, stable IDs, quota failure, DST gap/fold (Warsaw, New York and Kolkata), cross-midnight, zero-duration deadlines, protected rest, linked/series read-only and legacy non-quarter times. Browser tests include write failure/retry with draft intact, explicit dirty close, two same-origin tabs and desktop recurrence metadata preservation.

All browser profiles are disposable synthetic fixtures, with requests blocked except loopback. Screenshots: screenshots/all-types-en-390.png; importance/levels-{lang}-{width}.png; screenshots/editor-{lang}-{width}.png, editor-details-{lang}-{width}.png and linked-series-readonly-390.png. Older reports/screenshots outside this directory remain historical.

The keyboard check simulates a 420px-high viewport and validates focused controls/Save reachability; it is not a physical phone keyboard test. Physical iOS/Android, Safari, notification delivery and native OS picker differences are untested. There is no service worker or guaranteed offline shell. A forced browser termination can lose an unsaved draft; beforeunload is best effort.

## Run and reproduce

No dependency installation required for the application:

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Open http://127.0.0.1:8010 in the same machine's current browser (Web Locks/localStorage required). Stop with Ctrl+C. Windows: open the folder containing mobile/ in PowerShell and replace python3 with `py -3`.

With the existing managed Playwright/Chromium tools and the server running:

```sh
TZ=Europe/Warsaw node --test mobile/tests/model.test.mjs mobile/tests/tasks-model.test.mjs mobile/tests/calendar-model.test.mjs
node mobile/tests/calendar-editor.cjs
node mobile/tests/calendar-compatibility.cjs
MOBILE_IMPORTANCE_EVIDENCE=docs/mobile/compatibility/importance node mobile/tests/event-importance.cjs
MOBILE_CALENDAR_EVIDENCE=/tmp/path-calendar-compat-cards node mobile/tests/calendar-cards.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-calendar-compat-regression node mobile/tests/browser.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-calendar-compat-panel node mobile/tests/transformation.cjs
```

Isolation: all changes are in mobile/ and docs/mobile/. No desktop/AGENTS/root configuration, Paperclip, Daytona, production, GitHub writes, push/PR/merge/deployment or environment publication. Local commits are not an external backup or proof of persistence outside this workspace. Archive/bundle generation remains available through mobile/package.py, with no verified chat attachment export tool.
