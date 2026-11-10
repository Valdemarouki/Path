# Habits: grid placement and completion-cycle icon

10 November 2026. Isolated `Valdemarouki/Path` checkout `/workspace/Path`, local branch `feature/path-mobile-alpha`. Baseline `6da74ed6496994357afa2157198bfda76a5196af`; initial status clean. The owner's current mobile branch/origin authorization supersedes the historical Paperclip workspace instructions. No Paperclip service or worktree was used.

## Change

Expanded navigation now has this **DOM, visual and keyboard order**:

```text
Today       Calendar       Sport
Projects    Canvas         Habits
Notes       Progress       Profile
Settings    Sync status
```

Habits moved after Canvas. Every other section retains its relative order; there are still exactly 11 real cards and no filler cards. The existing responsive grid uses three columns at 390/430 CSS px and two at 320. The same sequence flows into two columns, placing Habits on the right of the third row at 320; no CSS order or positional override diverges from focus order. The scroller and pinned handle are unchanged.

Normal and compact navigation remain `Today / Calendar / + / Sport / Habits`, with Habits farthest right. The same semantic button moves between the row and its grid cell and returns on close; no duplicate accessible button is introduced.

`mobile/habit-icon.mjs` defines the new open circular cycle, one arrowhead and inset check. Navigation, its decorative motion overlay and existing application Habits icon slots use that single path definition. It is distinct from the unchanged two-arrow Sync symbol. Stroke weight, round caps, monochrome color, 27×27 navigation SVG dimensions and existing heading composition are retained. No emoji, icon spin or new heading layout was added. Both mobile builds package the shared module locally.

No CSS, glass material, timing/easing, animation controller, storage schema/model, other section behavior or desktop source changed. The controller derives the new destination from the grid's real geometry; no bespoke trajectory or rotation was added.

## Verification

Both static builds pass. Browser verification on synthetic disposable profiles:

| Suite | Cases | Result |
|---|---:|---|
| Habits placement/icon/motion evidence | 13 | PASS |
| Existing transformation | 21 | PASS |
| Existing panel | 30 | PASS |
| Existing application browser flows | 55 | PASS |
| Total | 119 | PASS |

The focused suite verifies EN/RU/ES × 320/390/430 px; exact DOM/visual/Tab order; Habits rightmost in row two on the standard grid; no placeholders or horizontal overflow; targets at least 44×44; shared application/nav icon; unchanged original button identity; normal and compact row order; direct expansion from compact; rapid reversal; OS and saved reduced motion. Navigation leaves each fixture's localStorage bytes unchanged. Existing suites retain real touch drag, history/Back, editor isolation, task/habit persistence and keyboard coverage. The new suite is included in `run-polish.cjs` for future full regressions.

Recorded Habits SVG left coordinates at 390 px: normal **331.09**, expanded **302.16**; observed range **301.83–331.41** CSS px. It stays in the right-hand region. Instant reversal has identical before/after coordinates. Four observed landings have less than 0.4 px change in either axis across adjacent 14–17 ms frames. SVG size stays 27×27 and its transform stays `none`: no stretching or independent rotation. Full samples and exact measurements are in [habits-motion.json](habits-motion.json) and [verification.json](verification.json).

This is Chromium/Linux browser testing, not a claim of physical iOS/Android or Safari verification. Data, accounts, production and credentials were not accessed. No dependencies were reinstalled.

## Evidence

- [Expanded panel, 390 EN](expanded-en-390.png), [320 RU](expanded-ru-320.png), [430 ES](expanded-es-430.png); all nine width/language combinations are stored alongside them.
- [Normal](normal-en-390.png) and [compact](compact-en-390.png), same 390×844 viewport.
- [Actual transition video, MP4](habits-transition.mp4), 3.43 s, H.264 390×844; opening, closing and rapid reversals. [GIF preview](habits-transition.gif) comes from those same recorded frames.
- [Focused checks](checks.json); existing suite logs: [transformation](transformation.txt), [panel](panel.txt), [browser](browser.txt).
- [Complete changed-file list for this correction](FILES.txt), [artifact checksums](SHA256SUMS).

## Repeat locally

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
# Another terminal, using already installed Playwright/Chromium/FFmpeg:
TZ=Europe/Warsaw MOBILE_HABITS_NAV_EVIDENCE=/tmp/path-habits-navigation node mobile/tests/habits-navigation.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-habits-transformation node mobile/tests/transformation.cjs
MOBILE_PANEL_EVIDENCE=/tmp/path-habits-panel node mobile/tests/panel.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-habits-browser node mobile/tests/browser.cjs
```

All changes are in mobile source/tests or mobile documentation/evidence. Desktop/root files, AGENTS.md, Paperclip, Daytona, main/paperclip-test and real user data are unchanged. No push, PR, merge, application deployment or environment publication. Local commits and artifacts do not establish an external backup or a verified chat download. Work stops after this correction.
