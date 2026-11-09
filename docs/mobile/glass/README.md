# Adaptive glass navigation — 9 November 2026

> The later [targeted refinement](../refinement/README.md) supersedes the tint,
> noise, scrim clipping, compact dimensions, handle focus and task counter below.
> This page retains the initial implementation evidence and state contract.

This is the current design contract, superseding the historical five-position
More row, the opaque edge panel and the floating capsule. Baseline working copy:
`/workspace/Path`, branch `feature/path-mobile-alpha`, initial HEAD
`22a8010edc3d2bd08ff6fe27ce6aad23046f0cae`. Earlier uncommitted reviewed work was
preserved in `580fddb863962f7484ae850d3f77b3b33691131d`. Implementation and tests:
`beeec009b799a94e2109e6c80f826f677e929018`.

## Scope and working behavior

The existing application and version-1 storage were retained. No dependency was
installed. IDs, tasks, events, habit history, EN/RU/ES and the separate mobile
storage key are unchanged. The new Habits screen reads and marks exactly the same
habit records and local date as Today. Calendar and Quick Add retain their
existing behavior. Russian duration metadata now uses `мин`.

The primary row is **Today / Calendar / Quick Add / Sport / Habits**. Quick Add
remains an action, never an active destination or a panel-expansion button. The
handle is a separately labelled 80×44 CSS px control above the gesture area.

The expanded panel offers Projects, Canvas, Notes, Progress, Profile, Settings
and Sync status. Settings contains the existing working language selector and
JSON export. Other secondary sections are explicitly unavailable screens, not
working projects/accounts/sync. No fake user, connected account or sync status is
shown. Selecting a secondary destination closes the panel, displays its honest
placeholder and clears primary-row selection. Reopening highlights that item
in the extra grid. Old `#more` bookmarks resolve to Settings; More is not a tab.

## One panel, three states

| State | Geometry and behavior |
| --- | --- |
| Normal | Handle, five-position row with readable labels, one active frame. 118 CSS px before safe-area padding. |
| Expanded | The same panel reveals the extra grid above the primary row. Three columns at 390/430; two at 320. Height is bounded by viewport minus 20 px. Internal overflow scrolls. |
| Compact | Downward scrolling hides labels and reduces the row to 48 px; targets remain at least 44×44. Total is 100 px before safe area. The handle opens directly from this state. |

The panel touches left/right/bottom viewport edges, with 30 px top corners and
square lower corners. The surface covers the gesture area; an internal
`8px + env(safe-area-inset-bottom)` gap protects controls. There is no artificial
phone chassis or home bar. A constant page-bottom reserve of 146 px plus inset
does not change with panel state, so content is never pushed or reflowed.

The scroll controller requires 36 px accumulated travel in a consistent
direction, ignores changes smaller than 2 px, and returns to normal within
32 px of the top. Overscroll is clamped. Expansion, dragging and editors suspend
automatic compaction. Destination changes restore normal mode.

## Gesture, focus and Back contract

Up/down gestures start on the handle, with pointer capture and `touch-action:none`.
After a 6 px intent threshold, reveal height follows the finger directly.
Release settles by velocity (0.4 px/ms) or a 45% open threshold. Grid scrolling
has no close gesture; it uses contained vertical scrolling. The handle button is
the keyboard/screen-reader alternative to gestures.

Expansion adds a moderate outside scrim, makes the page inert, fixes the body at
its saved scroll offset and traps Tab/Shift+Tab inside the panel. Escape, the
scrim, a down gesture or the handle close it and return focus to the handle.
Browser History Back dismisses an open panel through a temporary history entry.
Hardware Android/iOS Back behavior is not claimed as tested. Route selection
restores the page and focuses main content. Hidden grid items are inert.

Quick Add closes/suspends the navigation and uses the existing native dialog.
The navigation stays hidden while editing and is restored only after the dialog
closes. Resizing the viewport preserves form input. This is tested keyboard-size
simulation, not a real OS keyboard test.

## Glass material and surfaces

Supported browsers use **real `backdrop-filter: blur(20px) saturate(.15)`** with
`rgba(12,12,14,.30)` tint, not an opaque grey fill or a painted blur. Static
128×128 monochrome SVG noise is repeated at .045 opacity in a pointer-transparent
pseudo-element. Its seed is fixed; no noise animation exists. A faint 65 px top
highlight and a 130 px fading contour define the upper edge without a closed
bright capsule. Icons, labels and frame are unfiltered foreground elements.

Unsupported browsers use an explicit opaque `#171719` fallback with backdrop
filter disabled. A capability flag selects it; the same path is exercised in
tests. It is a readability fallback, not the primary approved material.

Cards and the editor keep graphite surfaces, 24–32 px corners, a subdued 1 px
outer edge, narrow dark inset, faint upper highlight and a soft lower shadow.
Ordinary task rows stay open. The local dot portrait is unchanged and decorative;
reflection text is original interface copy, not a philosopher attribution.

Repeated header slogans were removed. Only Today/Сегодня/Hoy retains the explicit
Z003/Chancery/script/serif calligraphic stack; other headings and all controls use
readable sans-serif. The installed Z003 font was checked for RU and ES coverage.
No web font or new font license was introduced. Devices without these local fonts
use the intentional italic serif fallback; exact real-device typography needs
separate review.

## New animation choices

These are implementation choices for this revision, not historically approved
numeric tokens:

- Panel height: 360 ms, `cubic-bezier(.22,.85,.25,1.06)`, with small settle.
- Finger dragging: no transition or easing while the pointer is captured.
- Row compaction: 260 ms, `cubic-bezier(.22,.75,.25,1)`.
- Label fade: 140 ms; label height follows the 260 ms row change.
- Extra items: 240 ms, only 4 px travel, with 0/25/45 ms stagger.
- Active frame: retained 420 ms `cubic-bezier(.22,.75,.25,1)`, retargeted from
  the actual in-flight position. Frame and buttons are persistent DOM nodes.
- Reduced motion removes all CSS travel/stagger/transition and JS frame movement.
  All destinations, gestures, buttons and editor functions remain available.

## Verification and measured limits

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
# In another terminal:
TZ=Europe/Warsaw node --test mobile/tests/model.test.mjs
MOBILE_EVIDENCE_DIR=/tmp/path-mobile-regression node mobile/tests/browser.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-mobile-surfaces node mobile/tests/surfaces.cjs
node mobile/tests/panel.cjs
```

Build passed; 12 model tests, 55 functional browser cases, 26 surface cases and
30 panel cases passed. `navigation.cjs` now delegates to the current panel suite
instead of asserting the superseded More design. No zero-test or skipped run is
counted as validation. External browser requests are blocked in every context.

Coverage includes normal/expanded/compact, real CDP touch input, intermediate
drag height, collapse, scrim/Escape/Back, focus trap/return, inert content,
unchanged card geometry and scroll restoration, shared habits, task creation
and reload, storage failure, locales, 320/390/430 px, 844×390 landscape, enlarged
panel labels, 34 px inset simulation, reduced motion and explicit no-blur fallback.

Pixel checks show that disabling actual backdrop filtering changes the same
content's rendered pixels, and scrolling content changes the image behind the
glass. CSS inspection also verifies backdrop blur and a separate sharp foreground.
This is not a static blurred bitmap. Real application content is used.

The recorded 90-frame scroll sample moved the document by up to 225 px with
blur/noise and ordinary motion enabled. p95 frame interval was **21 ms**; no
interval exceeded 50 ms. This is an unthrottled Linux Chromium sample, not a
physical-phone benchmark or a guarantee of 60 fps. Raw data: `timing.json`.

Not tested: physical iOS/Android, native keyboard/gesture conflicts, Safari,
WebKit/Firefox, screen readers and device font scaling. Browser viewport and
touch emulation do not establish those capabilities. Native functionality,
offline cold start, accounts, sync, Canvas and workout implementation remain
outside scope. Existing localStorage multi-tab race limitations still apply.

## Evidence and retention

- `normal-390.png`, `expanded-390.png`, `compact-390.png`: same 390×844 CSS viewport,
  same initial synthetic fixture and date, normal/expanded/collapsed scroll states.
- `material-390.png`: full expanded panel crop.
- `material-detail.png`: real 390×180 CSS px crop captured at device scale 2.
- `fallback-390.png`: explicitly simulated no-blur fallback.
- `panel.mp4`, `panel.gif`: actual Chromium compositor recording of touch
  expansion, collapse and page scrolling; encoded using installed system FFmpeg.
- `timing.json`: measured scroll frame intervals summary.
- `FILES.txt`: full files changed in this revision, excluding the separate
  preservation commit of earlier reviewed work.

Desktop, root configuration, AGENTS.md and production were not modified.
Paperclip/Daytona, secrets and remote GitHub writes were not used. Commits are
local to the feature branch. No application deployment or environment publication
occurred. These local files and commits are not external backups and do not
update the already published environment snapshot. Chat download availability
and recovery in a new cloud task remain unconfirmed.
