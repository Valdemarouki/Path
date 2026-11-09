# Mobile surface and bottom-edge revision — 8 November 2026

This revision changes CSS surfaces and geometry, not application features.
It retains the existing local data model, translations, calligraphic headings,
particle philosopher, navigation icons, separate Plus button and moving frame.
No new image was present in the request; implementation follows the owner's
numeric guidance and the previously supplied mobile board. No exact fidelity
claim is made for an unavailable new reference.

## Surface values

| Element | Values |
| --- | --- |
| Page | `#0B0B0C` |
| Surface | `#1D1D1F`, subtle white-to-transparent top highlight |
| Border | 1 px white at approximately 9% opacity; faint inset top edge |
| Main Task | 30 px radius, 20 px padding (18 px at 320) |
| Habits | 24 px radius, 18 px vertical / 12 px horizontal padding, minimum height 124 px |
| Up Next | Horizontal icon/copy arrangement, 26 px radius, 20 px padding; height follows translated content |
| More tiles | 26 px radius, 20 px padding, 14 px grid gap |
| Quick Add | 32 px top corners, 20 px side padding, at least 24 px bottom or the safe-area inset |
| Gaps | 12 px between habits, 14 px between More tiles, 16 px between primary working groups |

At 390 px habits stay in three columns; at widths up to 350 px they use two
columns to keep Cyrillic labels readable without shrinking text or hit areas.
Ordinary task rows remain open rows. No metrics, charts or decorative data were
added. Form controls retain 16 px input text, at least 48 px height and visible
keyboard focus. Native dialog focus handling and reduced motion are retained.
Quick Add now explicitly overrides the browser's default dialog max-width, so
it spans a phone viewport instead of leaving implicit user-agent side gutters.

## Bottom panel correction

This supersedes the floating-panel geometry in `../navigation/README.md`.
The panel is fixed at bottom/left/right 0, with 100% viewport width and no maximum
width. Only top corners are rounded (30 px); bottom corners are square. A thin
top/side outline follows the upper corners, with no bottom border. The opaque
dark background extends to the viewport edge and through the gesture area.
Buttons sit above an internal `8px + env(safe-area-inset-bottom)` padding.
No phone chassis rounding or system home indicator is drawn.

The same safe-area CSS variable also contributes to page-bottom spacing.
The last content element can scroll entirely above the panel. Icons, labels,
Plus button, frame motion and More ownership of nested destinations are unchanged.

## Verification

- `python3 mobile/build.py` — passed, no dependency installation.
- `node mobile/tests/surfaces.cjs` — 26 cases passed: EN/RU/ES at 320/390 px,
  edge-to-edge panel bounds/corners, target sizes, scroll clearance, form bounds,
  create/reload, task/habit actions, simulated 34 px inset and reduced motion.
- `node mobile/tests/browser.cjs` — 55 existing functional cases passed.
- `node mobile/tests/navigation.cjs` — 37 existing navigation cases passed.
- Real Chromium screenshots reviewed at 390 px; Russian More and habits also
  inspected at 320 px. Native Safari/iPhone safe-area and keyboard behavior remain
  unverified. The inset check is simulation, not physical-device validation.
- Existing desktop/root files, model and localization modules have no changes
  from the accepted baseline. Previous uncommitted navigation work is preserved.
- No commits, GitHub writes, deployment or environment publication performed.

## Reproduce comparisons

Run the loopback server as documented in `../README.md`. Screenshot fixtures use
390×844, EN, Europe/Warsaw and 8 November 2026 at 12:30, with identical initial
synthetic records. The BEFORE images capture the actual preceding working copy,
including its floating navigation. AFTER images include the bottom-edge fix.
Animations are settled for screenshots.

`node mobile/tests/surfaces.cjs` runs checks and captures AFTER images.
`--capture-before` is intended only before applying a future visual change;
do not use it now to overwrite this revision's BEFORE evidence.

## Files changed in this revision

```text
mobile/styles.css
mobile/navigation.css
mobile/tests/surfaces.cjs
docs/mobile/surfaces/README.md
docs/mobile/surfaces/before-today-390.png
docs/mobile/surfaces/after-today-390.png
docs/mobile/surfaces/before-habits-390.png
docs/mobile/surfaces/after-habits-390.png
docs/mobile/surfaces/before-more-390.png
docs/mobile/surfaces/after-more-390.png
docs/mobile/surfaces/before-quick-add-390.png
docs/mobile/surfaces/after-quick-add-390.png
```

The earlier uncommitted `mobile/app.mjs`, `mobile/index.html`, `mobile/build.py`,
`mobile/navigation.mjs`, `mobile/tests/navigation.cjs` and navigation evidence
remain present; they were not changed in this revision. Previous screenshot
evidence was preserved rather than replaced by regression-run captures.
