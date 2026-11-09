# Local tasks and Today — functional stage

## Delivered

Create with required trimmed title, today default, today/tomorrow/other-date shortcuts, optional duration/note under details. A pending submit is guarded against duplicate taps. The sheet stays open with its complete text on write errors. Success follows the actual storage write.

Click the task body to edit; checkbox only completes/uncompletes. Save is explicit. Closing a dirty sheet offers Continue/Discard. Editor actions select the main task for its date, fill tomorrow's date (then Save) or delete. Undo restores content and ID. Main is an explicit reference, excluded from Other tasks counts; completion keeps it visible, replacement leaves the old task intact, moving/deleting clears old references.

Today includes separate unfinished Overdue tasks, current-day tasks/habits and current/future events with a Happening now label. Calendar edits the same entities for its selected date. UI/validation/date/duration text supports EN/RU/ES. Manrope is locally bundled under its original OFL license; the existing glass/navigation material, geometry and motion implementation are unchanged.

[Model/migration/concurrency details](../TASK_MODEL.md). Prior typography preview work is preserved in this branch and bundled rather than discarded.

## Reproduce

Python 3 is the only runtime needed for the static prototype. No npm install, account, external API or CDN is needed.

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Open http://127.0.0.1:8010 on the same machine. Use a current browser with Web Locks and localStorage. Use HTTP localhost (or HTTPS), not file://. Stop with Ctrl+C. For Windows, extract the source archive and open PowerShell in the folder containing mobile and docs, then run `py -3 mobile/build.py` and `py -3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist`. This does not install or publish an application.

Existing managed test tools (Playwright, Chromium, fontTools, FFmpeg) are used only for validation, not as app dependencies:

```sh
node --test mobile/tests/model.test.mjs mobile/tests/tasks-model.test.mjs
MOBILE_EVIDENCE_DIR=/tmp/path-tasks-regression node mobile/tests/browser.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-tasks-panel node mobile/tests/transformation.cjs
node mobile/tests/tasks.cjs
python3 mobile/typography-preview/verify_font.py
```

The server above must be running for browser tests. Every test browser is disposable, synthetic and blocks non-loopback requests. No desktop build/test command is invoked.

## Validation

- Static mobile build: PASS.
- Existing + new model tests: 18 PASS, including v1 byte preservation, all entity IDs/history, lazy migration, failed writes and undo/reference invariants.
- Existing general browser suite, updated for async persistence and dirty-close/main-reference semantics: 55 PASS.
- Existing current navigation transformation suite: 21 PASS, including three states, touch following, rapid reversal, 320/390/430 × EN/RU/ES, safe areas and reduced motion. Its output is redirected to /tmp so older evidence is not overwritten.
- Task-specific browser suite: 24 PASS; see verification.json for the matrix. Covers create/edit/main/move/complete/reopen/delete/Undo, double submit, task/body separation, no main duplication, stable IDs, reload, explicit stale-tab retry, simultaneous writers, removed-elsewhere drafts, quota failure with no false success, midnight/focus/visibility, empty/all-done/150-task states, current/ended events, no-Web-Locks fail-closed editing, 320/390/430 × EN/RU/ES and reduced motion.
- Real font file: Cyrillic/Spanish coverage, variable axis 200–800, genuine distinct 200/300/400/500 outlines; OFL retained. Prior CDP glyph/fallback evidence is under ../typography-manrope.
- Existing-file changes outside mobile/ and docs/mobile/: none. navigation.css/navigation.mjs/styles.css are byte-identical to the stage baseline.

Evidence: today-{en,ru,es}-{320,390,430}.png; editor-en-390.png; task-lifecycle.mp4 and its GIF preview. The recording shows actual Chromium interactions at 390×844. Tests include a reduced viewport to model keyboard obstruction and keyboard focus/Escape; this does not verify an actual phone keyboard.

## Limits and recovery

Physical iOS/Android, Safari, OS background suspension and browser-specific native date pickers/IME have not been tested. Browser eviction/forced termination can lose an unsaved form; native beforeunload warnings are best effort. Undo is one-level and does not survive reload. Stale tabs are detected, not automatically merged; explicit load-latest preserves editor text for deliberate review/retry. Web Locks protects cooperating app tabs, not old clients or scripts bypassing the lock. Schema 2 is not readable by the older schema-1 app. There is no cloud sync or offline shell/service worker.

Commits and browser storage remain local to this workspace/browser. They are not external backups. Cross-chat/snapshot persistence has not been independently guaranteed. Save exported source/Git bundle to storage you control; the Git bundle contains commits, not browser localStorage. Settings JSON export is separate; importing it is not implemented yet.

The tools exposed in this chat do not include an attachment upload/export operation. Archives can be generated and locally verified, but a download through the chat cannot be claimed verified. See RECOVERY.md for filenames, checksums and offline recovery commands.

After this stage stop for owner review. Next candidate work: physical-device keyboard/Safari QA, browser-data export/import recovery, then event creation/recurrence. No other section's functionality was expanded.
