# PHONE R2 — scroll indicators and navigation motion

11 November 2026. Baseline: `9331562a91fe401fbe4ccd4c5447ae6e58f7b733`,
clean `feature/path-mobile-alpha` in `/workspace/Path`. The user reports that
the Windows → iPhone HTTPS setup works, and that opening/closing navigation
feels choppy on iPhone 12 Pro / Safari, iOS 26.6.1. No physical FPS trace was
provided or collected. This follow-up changes only mobile files and this report.

## Changes

- Shared `styles.css` hides page and nested scroll indicators using
  `scrollbar-width:none` and the WebKit scrollbar pseudo-element. Overflow,
  touch actions, scrolling, focus outlines and keyboard controls are retained.
  Browser chrome and native OS picker windows are outside the site's CSS.
- The four decorative navigation icon overlays now travel using translation
  transforms, retaining their unscaled 27 px SVGs and current painted position
  when interrupted. Accessible buttons are still the original unique DOM nodes.
- The transition no longer measures the panel and active frame from its resize
  observer on each animated-height frame. Reads of active-frame geometry are
  grouped, and unchanged frame geometry avoids another computed-style read.
- The uniform outside shade uses a transform from the same known endpoints and
  easing. Its lower edge still meets the top of the glass; it does not darken
  the glass. Only the flat shade is scaled, never text, icons or page content.
- Drag events are coalesced to one paint per animation frame. Release flushes
  the final pending position before settling; cancellation clears queued work.
  Resize and reduced-motion changes during a drag release pointer capture and
  discard stale endpoints. Shade geometry is refreshed explicitly on resize.
- Build identity is `PHONE R2` / `phone-preflight-2026-11-11-r2`, including the
  existing readiness page. The existing viewport test expects that identity.

Unchanged motion: expansion/collapse 440 ms, easing
`cubic-bezier(.22,.9,.25,1.06)`; card fades 180 ms with 25 ms stagger; Plus fade
180 ms; compact transition 320 ms. The 14 px real backdrop blur, 8% tint,
0.009 static noise, surfaces, grid order, touch targets and safe areas remain.
Reduced motion still bypasses spring, flights and stagger.

## Measurement

Actual full app, synthetic normal fixture (24 events / 32 notes), fresh Chromium
contexts on Linux, 390×844 CSS px, DPR 3. One warm-up then four open/close cycles,
native RAF timestamps and CDP Performance metrics. Baseline navigation code/CSS
were pinned from the baseline commit; the after run used the updated source.
Existing loopback server only; no external browser requests or new listener.

| CPU ×4, mean per transition | Before | After |
| --- | ---: | ---: |
| Opening layout passes | 60 | 35 |
| Opening style passes | 77 | 47 |
| Closing layout passes | 33 | 33 |
| Closing style passes | 77 | 46 |
| Opening main-thread task time | 228.01 ms | 225.99 ms |
| Closing main-thread task time | 185.80 ms | 191.10 ms |

The measurements establish fewer layout/style passes, **not a measured FPS
improvement**. RAF p95 remained approximately 16.8 ms in this environment.
Panel height/insets still animate as geometry, and backdrop rendering still
has a cost. Whether this removes the reported Safari hitch needs comparison
on the user's iPhone; no 60 FPS claim is made.

Raw profiles: `navigation-r2/before.json` and `navigation-r2/after.json`.

## Validation

Build, JavaScript syntax and `git diff --check` passed. Existing suites passed:

| Suite | Passed |
| --- | ---: |
| `mobile/tests/transformation.cjs` | 21 |
| `mobile/tests/habits-navigation.cjs` | 13 |
| `mobile/tests/refinement.cjs` | 13 |
| `mobile/tests/phone-gestures.cjs` | 7 |
| `mobile/tests/phone-viewport.cjs` | 8 |
| `mobile/tests/phone-performance.cjs` | 7 |

This includes 320/390/430 px × EN/RU/ES, unscaled icons, original controls,
rapid reversals, touch drag, compact geometry, background scroll preservation,
shade boundaries, existing material, system/saved reduced motion, focus,
numeric/editor scrolling, persistence and no retained transient layers/idle RAF.
Additional browser checks confirmed hidden scrollbars on root/body, panel,
dialog and textarea, retained mouse-wheel scrolling/keyboard focus at 320/390;
shade alignment after height-only resize; and cancellation when reduced motion
or orientation changes during an actual CDP touch drag.

Browser-generated recordings and selected raw checks are in `navigation-r2/`.
These are Chromium recordings, not an iPhone FPS recording. All profiles were
temporary, with synthetic records; existing user data were not read or changed.

## Updating the existing Windows test copy

The R2 update archive contains only four runtime replacements inside
`Path-Mobile/`: `styles.css`, `navigation.css`, `navigation.mjs`, `build-info.mjs`.
Save open drafts, extract the update, then copy its `Path-Mobile` folder into
`C:\PathMobile-Phone-Test`, accepting replacement of those four files. The local
server may remain running. Do not replace `Tools`, `Trust` or private certificates.
Reload the same Safari address and confirm `PHONE R2`; the existing origin, port
and storage keys remain unchanged. No dependency or certificate setup is needed.

The files in this workspace do not automatically update the user's computer.
Phone data remain in Safari on that origin. Neither a local commit nor an
archive retained only in this cloud environment is an external backup.

No desktop/root configuration/lockfile/AGENTS change, Paperclip or production
access, push, PR, merge, deployment or environment publication was performed.
