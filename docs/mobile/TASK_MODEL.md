# Local task lifecycle — schema 2

Scope: mobile/ and docs/mobile/ only, based on feature/path-mobile-alpha HEAD fca7eaabaee7c34dbec3b209ee30ac100d1a22d8. Prior uncommitted typography preview files were preserved. No account, production transport or desktop data is involved.

## Desktop meanings and differences

Read-only inspection: home.js homeTasks/taskRows/new-task handler, storage.js validation of homeTasks/project tasks, ARCHITECTURE.md and the existing mobile model. Desktop Today tasks have persistent id/title/date/duration/done, separate from project tasks with status/dependencies. Mobile keeps the Today-task meanings and IDs; it does not turn a Today task into a project task or event. Events keep existing absolute start_at/end_at, tzid and overlap semantics; habit schedules/checkIns/values are unchanged.

Mobile schema 2 adds optional plain-text note (up to 10000 characters) and mainTasks: a day-key → existing task-ID map. This is a mobile-only priority reference, not another task collection. A task must belong to its referenced day. Main completion never selects another task. Moving or deleting a main task clears its old reference; choosing a replacement leaves the previous task intact. Undo restores the original task snapshot/ID/index and its priority only if that day has no newer selection.

Task title: 1–500 trimmed characters, preserving compatibility with previously validated mobile titles up to 500. Optional duration: integer 1–10080 minutes. User titles/notes are never translated. Synthetic titleKey is removed on explicit edit, replacing it with the displayed title entered in the editor.

## Migration and preservation

The storage key remains path-mobile-alpha-v1: this names the established isolated namespace, not the current schema. Schema 1 is validated then cloned into schema 2 in memory. Its previous first task per date becomes the explicit main reference, preserving the former display. No IDs, records, unknown top-level/task fields, habit history or event instants are rewritten by migration. Existing bytes remain untouched until a successful user commit. That commit writes schemaVersion 2 and increments revision. Invalid or newer versions fail closed without overwriting the stored document. Downgrading to the older application after writing schema 2 is unsupported; retain an exported backup.

## Persistence and concurrent tabs

The browser UI uses one same-origin Web Locks exclusive lock named after STORAGE_KEY for initialization and every mutation, including language/habit changes. Inside the lock the repository compares the exact last-read serialized snapshot with current storage, validates a cloned candidate and writes once. Only after successful setItem does in-memory state advance and the UI report local success. Failed writes leave the editor and stored snapshot intact.

A stale tab is blocked by storage events or by the locked compare before writing. The user explicitly loads latest data while preserving all editor inputs, then reviews/retries the draft. A task deleted elsewhere cannot be silently recreated by saving its old editor. No automatic merge is attempted. A deliberate retry after loading latest data can replace the current values of that task with the retained draft; other tasks are preserved. Browsers without Web Locks cannot edit, and show a localized explanation instead of using an unsafe lock imitation. This protects cooperating copies of this mobile app, not arbitrary DevTools/old-client writes that bypass the lock.

The synchronous model API itself is for unit tests and callers already inside the UI lock; it is not a standalone cross-tab transaction API. localStorage persistence is subject to browser storage availability and clearing. It is neither cloud sync nor an external backup. There is no service worker/offline shell guarantee.

## Editor and recovery

Title/date are immediately available; optional duration/note are under details. Date shortcuts fill today/tomorrow or focus the date picker. All changes, including moving to tomorrow, require Save. Main selection and deletion are explicit editor actions and require saving or discarding any pending field changes first. Dirty close/Escape offers Continue or Discard; page unload requests the browser's native unsaved-work warning (browser policy governs whether it is shown). No draft survives forced process termination.

Undo deletion is one-level, in-memory, available until the next deletion or page reload; it restores exact content and ID. Export mobile test data remains available in Settings. JSON import is not implemented.

Today derives the current local day from the device clock, refreshed on focus/visibility and every 30 seconds. Background refresh preserves open editor inputs and its explicit date. Overdue includes unfinished past tasks only and never moves dates automatically. Upcoming includes ongoing/future events by absolute end instant; its label distinguishes ongoing from future and ended events are excluded. Calendar operates on the same task entities for its selected day.
