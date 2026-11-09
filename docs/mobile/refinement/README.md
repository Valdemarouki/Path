# Glass, compact state and task-counter correction — 9 November 2026

> The later [unified-grid transformation](../transformation/README.md) supersedes
> the expanded bottom row and compact geometry. Glass, counter scope and pointer
> focus treatment from this revision are retained.

Working copy `/workspace/Path`, local branch `feature/path-mobile-alpha`.
Started clean at `9889469eb2370af10f94457317442e0e939e85d7`.
Implementation/tests: `a44de346d14d54ee10638fe79c424f0fc66f5bb9`.
This is a targeted correction of the existing app, not a new prototype.

## Material audit

The earlier expanded panel combined a 30% dark tint with a 40% full-viewport
scrim beneath it. Static noise was .045 opacity. Those layers hid much of the
real backdrop effect despite a functioning filter.

Now:

| Layer | Current treatment |
| --- | --- |
| Container | `rgba(10,10,12,.08)` on supported browsers |
| Real backdrop | `blur(14px) saturate(.15)`; smaller blur retains recognizable soft shapes |
| Scrim | 26.7% black **outside** the panel; its bottom follows the actual animated panel top |
| Noise | Same deterministic monochrome SVG, .009 opacity, no animation |
| Highlight | White at 1.6% opacity at top, fades within 48 CSS px |
| Edge | 1 px subdued top contour, fades down the sides within 96 px; no bottom border |
| Foreground | Sharp icons, labels and active frame; no foreground filter |
| Fallback | Existing readable opaque dark surface only when blur is unavailable |

The outside scrim is clipped by geometry rather than painted under the glass.
A ResizeObserver tracks the panel during dragging/settling. No preblurred image,
invented glow patches, remote asset or new graphics library was introduced.
The recordings show actual task/habit cards and text moving behind the panel.

## Compact geometry and trigger

- Normal: **118 CSS px** plus safe area, with visible labels.
- Compact: **88 CSS px** plus safe area, a 30 px / 25.4% reduction.
- Compact labels have opacity 0 and rendered height 0; button accessible names
  remain present. The Plus button is still 46×46 px and all targets stay ≥44×44.
- The compact grip's 44 px hitbox extends 12 px above the surface, clear of the
  primary-row targets. Its visible line stays inside the upper material.
- After 36 px of consistent downward travel, compact mode engages. Changes
  smaller than 2 px are ignored; reversing direction resets accumulated travel.
  After 36 px upward, normal returns; within 32 px of the top it is normal.
- Compaction is suspended during expansion/dragging/editing. A 400 ms route-change
  and 500 ms close guard prevent restoration scroll events from causing jitter.
- Compact opens directly with the same handle. Page padding remains constant;
  no page layout or scroll offset is changed by compaction.

The previous compact screenshot was taken without asserting state after the
post-close guard. It could show normal mode despite its filename. Both current
test suites now wait for **actual compact state**, check zero-height labels and
settled geometry before capture. No state is forced for the evidence images.

## Focus, cards and counts

Only the handle's pointer-origin visual outline is suppressed. Keyboard events
restore its normal visible focus; Tab/Enter, the modal focus trap and Escape
return remain intact. Focus outlines elsewhere are unchanged. Pointer and keyboard
behavior are checked separately rather than relying on screenshot modality.

Card radii and graphite colors are retained. The edge uses a muted outer line,
darker 1 px inset and a faint upper highlight rather than brighter white around
the perimeter. Expanded-grid cards use the same layered edge and a light graphite
tint, allowing the real blurred page to remain visible behind the grid.

**Other tasks / Другие задачи / Otras tareas** counts only the rows in that
section. With the initial two tasks, Main Task is separate and Other tasks is
`0 / 1`. Completing Main Task does not change that counter; completing the extra
row changes it to `1 / 1`. IDs and the storage schema were not changed.

## Validation

Build passed. Existing mobile suites passed:

- 12 model tests: `TZ=Europe/Warsaw node --test mobile/tests/model.test.mjs`.
- 55 functional cases: `MOBILE_EVIDENCE_DIR=/tmp/path-refine-regression node mobile/tests/browser.cjs`.
- 26 surface cases: `MOBILE_EVIDENCE_DIR=/tmp/path-refine-surfaces node mobile/tests/surfaces.cjs`.
- 30 panel cases: `MOBILE_PANEL_EVIDENCE=/tmp/path-refine-panel node mobile/tests/panel.cjs`.
- 13 new refinement cases: `node mobile/tests/refinement.cjs`.

Serve the built app on loopback port 8010 as in the parent README. The tests use
disposable synthetic contexts and block external requests. Coverage includes
EN/RU/ES, 320/390/430 px, reduced motion, gestures, focus, no-blur fallback,
shared habits, task creation/reload, failed writes, no content movement and
counter scope. All passed; no failed/skipped/zero-test result is counted.

The existing panel scroll measurement sampled 90 frames while moving 225 px:
p95 20 ms, no interval above 50 ms. This is Linux Chromium, not a phone benchmark.
Physical iOS/Android, Safari, actual OS keyboards and screen readers remain
unverified. No claim of native-device validation is made.

## Evidence

All state screenshots use the same 390×844 CSS viewport, initial two-task
fixture and fixed local date/time, 9 November 2026 at 12:30 Europe/Warsaw:

- `normal-390.png`, `expanded-390.png`, `compact-390.png`: three real states.
- `normal-panel.png` and `compact-panel.png`: same-width direct comparison.
- `measurements.json`: actual geometry and computed material layers.
- `slow-scroll.mp4` / `.gif`: approximately 9.47 seconds of slow actual content
  scrolling under the glass, including compact/normal direction changes.
- `expand-collapse.mp4` / `.gif`: approximately 5.07 seconds of opening/closing,
  including opening directly from compact mode.

Recordings use actual Chromium compositor frames and the existing system FFmpeg.
They are not synthetic animation mockups. Prior evidence in other folders is
preserved. Local files are not verified downloadable chat attachments.

Desktop, AGENTS.md, root configuration, data schema and other sections were not
modified. Paperclip, Daytona, credentials and production were not accessed.
No push, PR, merge, deployment or environment publication occurred. Commits are
local and do not constitute external backup. `FILES.txt` lists this revision.
