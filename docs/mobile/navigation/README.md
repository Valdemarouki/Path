# Bottom navigation review — 8 November 2026

Scope: mobile bottom navigation only, based on the owner's approved Board 03.
Existing screen markup, data models, desktop code and root settings are unchanged.
No new commit, GitHub write, application deployment or environment publication.

The five fixed positions remain Today / Calendar / Quick Add / Sport / More.
The panel has a rounded dark surface, thin border, restrained glow and outlined
temple/calendar/plus/Spartan helmet/Ionic column icons. One persistent decorative
frame moves for 420 ms; buttons and labels do not move. Rapid taps retarget from
the actual intermediate frame position. Normal content renders and language
updates preserve the same navigation nodes. Reduced motion positions the frame
immediately and cancels movement when enabled during a transition.

Quick Add is a separate 46×46 px button and keeps the owning tab selected.
Every navigation target is at least 44×44 CSS px, including at 320 px width.
The panel sits 12 px plus the bottom safe-area inset above the viewport edge.
No iPhone system/home bar is drawn. Existing page padding permits the last
content element to scroll entirely above the panel.

Projects, Habits, Notes, Canvas, Progress, Profile and Settings belong to More.
These screens are not implemented in this alpha; their hash addresses resolve
to the existing More overview and select More rather than Today. No new fake
project or account screen was added.

## Validation

- Static build: `python3 mobile/build.py` — passed.
- Existing functional browser suite: 55 cases passed, including task/habit
  persistence, locales, midnight, storage failure, keyboard and reduced motion.
- Navigation suite: `node mobile/tests/navigation.cjs` — 37 cases passed, plus
  direct checks of nested route grouping. Requires the loopback server on 8010,
  preinstalled Playwright, Chromium and system FFmpeg.
- Matrix: 320/390 px × EN/RU/ES × four destinations. Checked one persistent frame,
  actual intermediate movement, rapid retargeting, constant button geometry,
  target sizes, active ownership, content clearance and horizontal overflow.
- Reduced motion, Quick Add ownership, nested hash navigation/reload and keyboard
  activation passed. Existing files outside mobile/docs-mobile have no diff.
- Physical iPhone/Android safe areas and Safari were not tested; safe-area use is
  implemented in CSS, not a claim of device validation.

## Evidence

- `today-390.png`, `more-390.png`, `calendar-ru-320.png`: actual Chromium screenshots.
- `navigation.mp4`: approximately six seconds of actual Chromium compositor
  frames, encoded at 390×844 and 30 fps by system FFmpeg.
- `navigation.gif`: cropped view of the same recording, focused on the panel.

The optional Playwright recorder failed because its bundled FFmpeg was absent.
The test therefore records via CDP and uses `/usr/bin/ffmpeg`; nothing is installed.
To regenerate the GIF after the navigation test:

```sh
ffmpeg -y -i docs/mobile/navigation/navigation.mp4 \
  -vf 'crop=390:112:0:732,fps=20,split[a][b];[a]palettegen[p];[b][p]paletteuse' \
  docs/mobile/navigation/navigation.gif
```

These are local evidence files, not verified downloadable chat attachments.
