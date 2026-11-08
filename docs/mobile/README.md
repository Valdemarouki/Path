# Path Mobile alpha 01

Standalone mobile web prototype, based on `Valdemarouki/Path` commit
`2f4d73bfa18d2a04c1d7520116b0d9bd8d5d173c`, local branch
`feature/path-mobile-alpha`. No native app, account, backend, sync, installation,
service worker or deployment is included. User-supplied Board 03 is a visual
reference for outlined navigation, restrained monochrome surfaces, classical
headings and More tiles, not evidence of working account/project features.

## Run and build

No package installation is needed. Python 3 builds and serves static files:

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Open the loopback server in a browser on the same machine. This is a local
development address, not a published preview. Opening HTML directly via `file:`
is unsupported because ES modules require HTTP. The server binds only loopback.
Stop it with Ctrl+C. No desktop build script is involved.

```sh
node --test mobile/tests/model.test.mjs
node mobile/tests/browser.cjs
```

The browser tests require the environment's existing `playwright` and
`/usr/bin/chromium`, and the server above. No npm dependency or root lockfile is
added. Tests use temporary browser contexts and block non-loopback requests.

## Included flows

Today shows the first task for the current system-local date, further tasks,
the next ongoing/future event, and habits due today. The first task remains in
place on completion; it is not automatically replaced. Quick Add creates a task
for today or the selected Calendar date. The title is required (160 characters
maximum). Tasks and habits can be marked and unmarked. Calendar is a read-only
day agenda of events plus actionable tasks for that date. More offers language
selection and JSON export of the mobile test state. Sport and unsupported More
destinations are explicitly marked unavailable, with no pretend actions.

EN is always the initial language; explicit EN/RU/ES selection is persisted.
Only UI and synthetic fixture labels are translated, never user-authored titles.
Date labels use the selected locale; language never changes timezone.

## Data contract and desktop differences

All data is synthetic. A fresh profile creates a small fixture once, using the
local date and one event an hour ahead. Fixture IDs remain stable. New task IDs
use `crypto.randomUUID()` and never change when toggled/reloaded. There is no
desktop import and no access to desktop storage, browser profiles or adapters.

| Entity | Preserved meanings | Deliberately limited in this alpha |
| --- | --- | --- |
| Task | `homeTasks`, permanent `id`, `title`, local ISO `date`, boolean `done`; optional duration in minutes | No project task/status/deadline mapping, editing or deletion. First task is visual focus only. |
| Event | `id`, wall `date/hour`, elapsed `duration`, `tzid`, `fold`, `start_at/end_at`, `type` | Fixture events only; no creation, recurrence, linking, conflicts, or DST wall-time editor. Instants are authoritative for display and selection. Cross-midnight events appear on every intersecting local day. |
| Habit | `id`, `name`, `startDate`, dated `schedules`, `checkIns` and numeric `values`; weekday numbers 0–6 | Manual completion goal 1, daily or selected weekdays only. No weekly/count/duration/sport-source editing, availability history, streak metrics or migration. Unsupported schedule kinds are rejected. |
| Settings | Explicit device-local language | Mobile settings stored with the mobile snapshot, not desktop language keys. |

Mobile envelope: `schemaVersion:1`, revision, language, createdAt, homeTasks,
events, habits. Fixtures add `titleKey`/`nameKey` solely for translated demo copy.
The separate origin-localStorage key is **`path-mobile-alpha-v1`**. The desktop
schema is neither read nor mutated. Mobile JSON is not a compatible desktop
backup and must not be imported there. Dates are currently bounded to 2000–2099.

## Persistence and recovery

Each mutation validates a cloned candidate, checks for stale-tab data and writes
one localStorage snapshot before updating the UI or celebrating completion.
Quota/write failures preserve the previous committed state; task input remains
in the open sheet. Corrupt/unsupported existing state is never overwritten with
fixtures. A visible error blocks destructive recovery. Recovery is manual;
there is no import UI. Export mobile test data before clearing browser storage.

A `storage` event or stale snapshot blocks further writes and requests reload;
copy any open task draft first. This is optimistic conflict detection, not an
atomic multi-tab lock: simultaneous read/check/write races remain possible.
There is no desktop Undo/Redo history. Do not use this alpha for valuable data.
Browser cleanup, private-session termination, origin/port changes or environment
replacement can make records unavailable. Local saving is not cloud backup.

## Interaction, accessibility and visual decisions

Single-column phone layout, safe-area insets, fixed five-position navigation,
minimum 44–48px touch controls, visible focus, semantic headings and native
dialog focus trapping/Escape dismissal. Quick Add closes explicitly or with
Escape; failed saves retain input. Completion animates only the check glyph;
nearby card positions do not change. Route fades and sheet entry honor reduced
motion, which disables all CSS animations/transitions. Clock refresh avoids
closing an open editor. A saved task for yesterday is not silently moved after
midnight. Calendar selection stays independent of Today.

The portrait is an unchanged local copy of
`assets/Path_2_0_Marcus_Aurelius_Particles.svg`, decorative and static. The
reflection text is original interface copy, not an attributed quotation.
Typography uses system sans-serif and a calligraphic/italic serif fallback stack;
exact appearance varies by device. No remote fonts or analytics. A bundled,
licensed EN/RU/ES calligraphic font and real-device typography review remain
follow-up work. CSP denies all script network connections, remote assets,
frames/objects and form submissions.

## Result retention

Local commits preserve source history only inside this checkout; they are not
an external backup. This chat previously verified that the baseline and local
feature branch survived a published-snapshot reconnection. That is evidence for
that baseline, not a guarantee for subsequent unpublished mobile work. No
environment republishing or GitHub writes are authorized for this stage.
Use an exported source archive and Git bundle, downloaded to storage you control,
for independent recovery. A bundle restores commits/branches but not untracked
files or browser localStorage. Export mobile test JSON separately if needed.
Saving files or commits does not publish an application or update the existing
published environment snapshot.
