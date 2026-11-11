# PHONE R3 — coherent navigation layers

11 November 2026, Europe/Warsaw. Worktree `/workspace/Path`, local branch
`feature/path-mobile-alpha`, starting clean at
`3b4bee560ee2547ba0a27fc89733c6e11155cae2` (PHONE R2).

The same overlap shown in the iPhone screenshot was reproduced in R2's
navigation. The R3 update includes the four runtime files needed for updating
either R1 or R2 directly, including R2's hidden scrollbars and motion work.

## Reproduction and fix

Closing returned the primary buttons to their bottom row immediately, while
`[data-transitioning] .nav-extra` kept the grid heading visible throughout the
440 ms transition. In a 390×700 snapshot at 320 ms, the 28 px heading and the
66 px primary row occupied overlapping vertical space. Canceling the current
root animation also left its transition flag set, the extra area visible and
Quick Add inert. This cancellation scenario was reproduced programmatically;
it does not establish that Safari canceled the animation in the user's photo.

Changes:

- Opening and closing have explicit transition phases. During closing the
  extra area's clip ends above the full 66 px primary control band.
- The whole extra area, including its heading, fades from its currently painted
  opacity. Reversing motion does not reset the heading to full opacity.
- Completion checks the current serial and motion token before cleaning up
  any layer. A queued old callback cannot cancel newer card animations.
- The current animation's rejection settles the requested target. A single
  bounded 600 ms fallback clears a transition whose completion is lost; normal
  open/close timing remains 440 ms. The fallback is canceled on settlement or
  replacement and is never scheduled during a finger drag.
- Resize, reduced-motion change, page hide/show and editor suspension use the
  same settlement path. Pointer capture loss cancels the drag safely. Temporary
  icons, alpha animations, pending drag frames and fallback timers are removed.
- Existing semantic buttons keep their identity. Unnecessary reparenting is
  avoided; settling a transition preserves keyboard focus already in the grid.

The glass/blur/noise, surfaces, icon paths, hierarchy, grid order, compact
dimensions, safe areas, 44 px targets and spring timing remain. Page layout,
saved scroll position, storage keys and models were not changed. Hidden grid
controls remain inert/aria-hidden; Quick Add returns after closing.

Build identity: `PHONE R3`, `phone-preflight-2026-11-11-r3`.

Comparable browser screenshots at 260 ms of closing, 390×844 CSS px:
[before](navigation-r3/before-panel-390.png),
[after](navigation-r3/after-panel-390.png).

## Verification

The new frame-sampling test, pinned to R2 navigation, failed as expected with
**14 overlapping frames at 320 px / EN**. Current code passes that same test.
The independent seek/cancel test also fails on R2 and passes on R3. Baseline
evidence is retained under `navigation-r3/`.

Build, syntax, `git diff --check` and mobile-only change scope passed.

| Browser suite | Passing groups |
| --- | ---: |
| `navigation-lifecycle.cjs` — timeline seeks, native cancel/pause, stale callback, focus, resize, page events | 18 |
| `navigation-layers.cjs` — actual RAF samples, 320/390/430 × EN/RU/ES, cancellations and reversals | 14 |
| `transformation.cjs` | 21 |
| `habits-navigation.cjs` | 13 |
| `phone-viewport.cjs` | 8 |
| `phone-gestures.cjs` | 7 |
| `refinement.cjs` | 13 |
| `phone-performance.cjs` | 7 |
| Total | **101** |

Fresh synthetic profiles only. Both new suites fulfill requests from local build
files and need no server. The existing loopback listener returned an empty
response, so existing suites used local-file request interception via the
recorded `preview-hook.cjs`; no replacement listener or network access was
opened. The adapter preserves the performance suite's browser offline state.
All external requests remained blocked. Idle timer/DOM/RAF bounds passed on
the existing normal and large synthetic fixtures.

The recording `navigation-r3/navigation-r3.mp4` shows ordinary open/close,
90 ms reversals and actual CDP touch drags. It contains 212 captured Chromium
frames over 6.38 seconds with their original timestamps; MP4 output is 30 fps.
The GIF is a 12 fps preview. This is **Chromium/Linux evidence, not an iPhone
FPS measurement**. Safari 26.6.1, its toolbar resizing and actual background
behavior still require the user's physical-device retest. Page events in the
automated lifecycle cases are synthetic.

Reproduce the new checks after `python3 mobile/build.py`:

```sh
node mobile/tests/navigation-lifecycle.cjs
node mobile/tests/navigation-layers.cjs
# Expected regression failure against the preceding implementation:
MOBILE_NAV_LAYERS_BASELINE=3b4bee560ee2547ba0a27fc89733c6e11155cae2 node mobile/tests/navigation-layers.cjs
```

## Update on Windows

Save open drafts. Extract the R3 update ZIP and copy its `Path-Mobile` folder
into `C:\PathMobile-Phone-Test`, accepting replacement. It contains four runtime
files (`styles.css`, `navigation.css`, `navigation.mjs`, `build-info.mjs`) plus
`BUILD.txt`. Keep the same folder depth, origin and port. The existing HTTPS
server can stay running. Refresh the same Safari page and confirm `PHONE R3`.
Installing R2 first is unnecessary. Tools, Trust and private keys are not in
the update; no certificate, firewall or dependency setup is needed.

Recheck ordinary and fast open/close while scrolled down, drag and release the
handle, show/hide Safari's toolbar, rotate, and briefly switch applications.
After closing there should be only the primary row; the extra heading must
not remain over it. No clearing of Safari storage is required.

No desktop/root configuration/lockfile/AGENTS change, Paperclip or production
access, real-data import, push, PR, merge, deployment or environment publication
was performed. Local commits and archives retained here remain local to this
environment until copied elsewhere; they are not external backups.
