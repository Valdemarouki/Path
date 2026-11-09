# Unified navigation transformation — 9 November 2026

Current contract. The owner's latest instructions supersede the separate primary
row in the expanded panel and the earlier full-width compact mode. Work remained
in `/workspace/Path`, branch `feature/path-mobile-alpha`, starting clean at
`7f46c7052758348e4238a3d0c0518e7eab427e12`.
Implementation/tests: `16377f5ca24083d77678bf7b722eff1b1a65132c`.

Only production navigation files changed: `mobile/navigation.mjs` and
`mobile/navigation.css`. Existing screens, app event handlers, task/habit data,
localization strings, storage schema, portrait and card surfaces were retained.

## Three states

| State | Contract |
| --- | --- |
| Normal | Full-width edge panel, Today / Calendar / + / Sport / Habits. 118 CSS px plus safe area. |
| Expanded | One grid of 11 cards: Today, Calendar, Sport, Habits, Projects, Canvas, Notes, Progress, Profile, Settings, Sync status. No separate bottom row and no Plus cell. |
| Compact | Centered, bottom-attached panel, 64 CSS px plus safe area; no labels. Side margins are 18 px on 390/430 and 10 px on 320. |

Expanded cards share one grid/cell/button style, including primary destinations.
The current destination is highlighted in its card. The grid uses three columns
at 390/430 and two at 320; rows share a minimum 120 px sizing system and grow for
text. At insufficient height the grid scrolls internally. The handle is separate
from that scroller and remains pinned and available. Maximum panel height leaves
at least 16 px or the upper safe-area inset, whichever is larger; a simulated
64 px upper inset was checked in addition to the 34 px lower inset.

The normal primary buttons themselves move between the row and the first four
grid cells. They keep their DOM identity, IDs, handlers and accessible names.
The Plus stays outside the grid, fades/scales away and becomes inert; the empty
row is hidden after opening finishes. On close the same buttons return to the
row and Quick Add becomes available after its reappearance. Hidden grid content
is inert and aria-hidden when folded.

## Continuous transformation

The panel changes actual height and side insets. Text/icons are never scaled to
resize the panel. Four temporary decorative, aria-hidden, pointer-transparent
SVG overlays travel from the current icon coordinates to the corresponding card
coordinates. The underlying semantic buttons are reparented, not duplicated.
Overlays are removed on completion or interruption. Only the Plus uses a small
scale change, as requested.

New motion choices, not historical tokens:

- Open/close: **440 ms**, `cubic-bezier(.22,.9,.25,1.06)`, slight overshoot and
  one return. Geometry and primary icon flights share the same timing.
- Cards: **180 ms** opacity/4 px translation, **25 ms** between cards, maximum
  delay 250 ms. The last item settles within the panel's 440 ms transition.
- Plus: **180 ms** opacity and scale 1 ↔ .9; it is never a grid item.
- Compact width/height: **320 ms**, quieter `cubic-bezier(.22,.85,.25,1.025)`.
- Row controls resize their boxes rather than scaling glyphs; labels fade over
  140 ms and collapse over 180 ms. The active frame follows the actual row geometry.
- Finger dragging has no easing. It starts from the exact current geometry,
  including when a previous transition is still running.
- A new target snapshots the current painted panel/icon coordinates, cancels the
  previous animation and retargets from there. There is no busy lock on the handle.
  A new pointer-down clears suppression of the previous drag's compatibility click.
- Reduced motion bypasses flights, bounce and stagger and immediately presents
  the target layout with all functions intact.

The compact handle has an unshrunk 44 px hit area extending above the glass; its
visible grip sits just inside the upper edge. This permits a 64 px panel without
overlapping the 44 px primary targets. Compact Plus is 44×44; normal Plus is 46×46.
The active frame becomes smaller with the row. There is no exterior bottom gap.

## Preserved material, page and accessibility

Actual 14 px backdrop blur, 8% tint, .009 static noise, faint top highlight,
fading upper outline and explicit dark fallback are unchanged. Foreground SVGs
and labels stay sharp. Safe areas are internal; no phone chassis/home bar is drawn.
Page-bottom reservation remains constant, so panel changes never reflow cards.

The 36 px directional scroll threshold, small-movement filter and top reset are
retained. During guarded programmatic scrolls the baseline is now updated, so a
previous scroll position cannot suppress the next real downward gesture. The
temporary panel history entry uses manual scroll restoration, then restores the
previous browser setting after dismissal. This prevents browser Back restoration
from undoing a destination's scroll reset. A focused check verified restoration
of that browser setting after close.

Modal inertness, Tab trapping, Escape, outside click and browser Back remain.
Touch opening now explicitly focuses the handle, so Escape works immediately
after a gesture as well. Repeated actions can reverse motion before settling.
The only temporary duplicate graphics are inaccessible decorative SVGs, never
buttons. Additional sections still show honest unavailability; Settings retains
working language/export. No other feature implementation was added.

## Verification

Build passed. Existing suites, adapted for the new layout, passed:

- 12 model tests.
- 55 functional cases.
- 26 surface cases.
- 30 panel cases (including touch, Back, shared habits, failures and fallback).
- 13 glass/focus/counter refinement cases.
- 21 new transformation cases.

Transformation coverage: primary-first ordering; exactly 11 cards and no Plus
cell; persistent unique primary controls; equal cell sizing; active grid card;
hidden/inert row; focus trap; same page card geometry; 64 px compact geometry and
touch targets; immediate expansion from compact; atomic before/after reversal
coordinate checks; 27×27 unscaled flight SVGs; touch focus/Escape; secondary route
selection; 320/390/430 × EN/RU/ES; 844×390 internal scrolling; reduced motion; and
a simulated 34 px bottom inset. Old snapshots remain intact.

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
# In another terminal:
TZ=Europe/Warsaw node --test mobile/tests/model.test.mjs
MOBILE_EVIDENCE_DIR=/tmp/path-grid-regression node mobile/tests/browser.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-grid-surfaces node mobile/tests/surfaces.cjs
MOBILE_PANEL_EVIDENCE=/tmp/path-grid-panel node mobile/tests/panel.cjs
MOBILE_REFINE_EVIDENCE=/tmp/path-grid-refinement node mobile/tests/refinement.cjs
node mobile/tests/transformation.cjs
```

The tests use installed Chromium/Playwright/FFmpeg, disposable synthetic contexts
and loopback only. No dependency installation or external service is needed.
Physical iOS/Android, Safari, native screen readers, keyboard and OS gesture
interactions remain unverified; browser emulation is not device testing.

## Evidence and files

`normal-390.png`, `expanded-390.png`, `compact-390.png` use the same 390×844 CSS
viewport, initial synthetic data and fixed 9 November 2026 12:30 Europe/Warsaw.
`row-to-grid.mp4` / `.gif` show opening, closing and rapid reversal, about 4.4 s.
`compact-resize.mp4` / `.gif` show both width and height change on scroll and
return upward, about 6.93 s. These are actual compositor recordings, not mockups.
`FILES.txt` lists the complete changed files for this revision.

Commits and evidence are local, not external backups or confirmed downloadable
chat attachments. Desktop/root configuration/AGENTS.md and existing data were
not modified. Paperclip, Daytona, production and credentials were not accessed.
No push, PR, merge, deployment or environment publication occurred.
