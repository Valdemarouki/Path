# Calendar / Habits: offline preparation, disabled

RC15 explicitly packages the client modules from this directory. The main
process routes existing profiles through v1 until the user chooses expanded
sync from the dedicated profile controls. Expanded exchange in RC15 supports a separate per-device automatic-sync opt-in;
its activation journal is per profile and disables v1 automatic sync. SQL is
not executed by the application. See `RC15_GUIDE_RU.md` for current rollout
instructions; `SERVER_STAGE_RU.md` describes the earlier preparation stage.

## Dependency audit

| Data | Relationship | Prototype rule |
| --- | --- | --- |
| Calendar task block | `taskId`, optional `projectId` | Referenced task must exist in the same snapshot and belong to that project. Deletion versus concurrent linking is a conflict. |
| Project deadline | `calendarProjectDeadlines()` renders `task-deadline:<id>` from task deadline | Never persist a synthetic deadline as an event. |
| Recurring event | `eventSeries`, `seriesId`, `occurrenceDate`, `cancelledDates` | Series metadata and all materialized occurrences form one conflict unit. Keep original IDs; never regenerate occurrences during merge. |
| Calendar time | `date/hour`, `tzid`, `fold`, `start_at/end_at` | Explicit zone and consistent instants required for non-deadlines; unstamped legacy events block preparation until a deliberate migration exists. |
| Manual habit | `values`, `checkIns`, `exceptions` by date | Merge separate dates; treat all three fields of one date atomically. Never add two independently changed counters. |
| Habit schedule/history | `schedules`, `availability`, other metadata | Concurrent metadata and log changes require review rather than interpreting a log under a different schedule. |
| Sport habit | Habit source derives from `workoutRecords` | Block the entire prototype snapshot with `SPORT_DEPENDENCY`; do not silently omit records or invent manual values. |
| Workout event | Template/snapshot/program references | Block until Sport has its own synchronization contract. |
| Notes, Canvas, settings, workout history | Local-only roots | Not included in projection. No application of a remote draft to the user's state is implemented. |

## Implementation

`calendar-habits.cjs` supplies a schema-2 draft codec with mandatory injected
application validators. Tasks/projects reuse the existing conservative
three-way merge. Events and habits merge by stable ID; incompatible edits
return null. Cross-record validation runs after merging. The snapshot is capped
at 2 MiB. Schema 1 rejects it, deliberately preventing accidental use of old RPCs.

`offline-draft.cjs` stores owner-bound local/base/pending snapshots through the
existing atomic file store. Persist before returning a simulated operation;
retry the same operation after restart. Check revision/payload/id on ACK and
preserve newer edits. Persist rejected remote versions and prevent another
operation until a successful rebase. A conflict preserves both local and remote
versions. Storage errors propagate without replacing the last committed state.
There is no automatic conflict discard or whole-profile overwrite.

`session-v2.cjs` coordinates the test queue with the app checkpoint: backup
before activation/application/conflict choice; durable application intent;
recovery after a crash before or after local commit; explicit initial cloud
adoption; preservation of in-flight edits. `checkpoint-adapter.cjs` uses the
real repository contract, preserves local-only roots and blocks deletion of
IDs referenced by them. `transport-v2.cjs` requires `testMode: true`, uses only
the fixed Supabase origin, obtains a verified token from its caller, refuses
redirects and validates responses. RC14 imports these through its dedicated main-process host only when the expanded-sync action is requested.

This is an opt-in test protocol, **not enabled by default**. Its store
must be a separate test file, never an existing schema-1 journal. It requires a
known common base; `session-v2.cjs` adds explicit activation/adoption bootstrap.

## Verification, 2026-10-31

Run `node project-control/check-calendar-habits-draft.cjs` from the source root.
19 checks cover projection/isolation, convergence and duplicate prevention,
same-event conflicts, link deletion, date-level habit merging, schedule/log
conflicts, series cancellation, Sport refusal, invalid inputs, DST, durable
restart/retry, in-flight edits, owner mismatch, failed storage, CAS rejection,
and revision rollback. Uses actual storage/time validators and temporary files.

In the initial preparation nine regression scripts also passed: check-sync-merge, check-cloud-sync
(PGlite PostgreSQL), check-sync-integration, check-habit-history, check-habits,
check-calendar-zones, check-recurrence, check-linked-flows, check-storage.
Network behavior in these tests is simulated; no live Supabase changes or
Windows/two-computer verification was performed in this preparation.

The server stage adds 13 PGlite PostgreSQL scenarios and 16 test session
scenarios. A pair of sessions also exchanges changes through the real SQL RPCs,
including a replayed receipt after a simulated lost HTTP response. Tests use
simulated auth claims; they do not validate real Supabase-issued OAuth tokens
or simultaneous transactions on a hosted PostgreSQL cluster.

## Remaining validation before general release

1. Decide how Sport-linked records and legacy unstamped events migrate. Current
   fail-closed behavior is intentionally too restrictive for general release.
2. Review and apply the prepared migration only as part of the dedicated test
   rollout. It creates v2 RPCs/tables and adds serialization/upgrade guards to
   v1 RPCs. Accounts remain on v1 until individually opted in and activated.
   Never reapply migration 001 after 002: that would remove the v1 guards.
3. RC14 wires bootstrap/session/checkpoint handling through a main-process host
   bound to the verified identity. Complete native Windows and real OAuth tests;
   audit full field allowlists before general release.
4. RC14 provides manual controls, explicit choices and a profile-scoped journal.
   Expanded automatic sync remains off. Test mixed client versions and real
   network loss during read, push, ACK and local application.
5. Run Windows/two-device scenarios below before public enablement.

## Batched manual checks

For current RC13: install and launch via chosen desktop shortcut; close/reopen
without browser login; verify guest/account separation; scroll to check the
compact profile button; edit separate tasks simultaneously; edit one task on
both machines; disconnect/reconnect and restart with pending edits. Confirm
backups and that notes/canvas remain local.

Only after a dedicated Calendar/Habits test build: two distinct events; same
event edited twice; recurring cancellation versus edit; linked-task deletion;
different habit dates; same date value versus skip; pause/archive versus log;
different device zones/DST; offline restart and lost ACK. Both devices must
converge or display a conflict without loss. Do not expect these new sections
to synchronize in RC13.
