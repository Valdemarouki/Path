# Desktop browser acceptance evidence

Regenerate from the repository root after building the app:

```sh
node project-control/check-sport-package-browser.cjs
```

The runner requires the existing Playwright package, `/usr/bin/chromium`, and
optionally `/usr/bin/ffmpeg` for the MP4. It does not install dependencies or start
a web server. Chromium requests to `https://sport.local` are fulfilled from local
build files; every other request is aborted. Each run creates a fresh browser
context and an explicitly synthetic checkpoint. No existing browser profile,
account, user data, or service is used.

`report.json` is the authoritative result, including the tested HTML SHA-256,
browser version, viewport evidence, blocked request list, assertions and any
failure. Screenshots are actual browser renders at the size named in each file.
The MP4 uses captured frame timestamps and preserves elapsed time.

The UI flow creates a program and two templates, exercises the full catalog,
filters/favorites/recent/custom definitions, immediate adding and Undo/Redo,
typed goals, explicit duplication and reordering, one Calendar event and its
move, actual weight/reps and fractional seconds, rest/draft restoration,
single-session guards, write failure/retry, partial finish and immutable history.
It also checks two-tab conflict handling and EN/RU/ES layouts at 1366×768 and
1920×1080, keyboard activation, 125% text CSS, and reduced-motion emulation.

This is Linux Chromium browser evidence for the desktop HTML artifact. It does
not verify an installed Windows build, physical iPhone, Safari, PWA installation,
background audio, or cold offline startup. Mobile and desktop-test adapter
evidence is reported separately.

Latest run: **PASS**, 11 November 2026, 20:39:57–20:40:40 UTC. Chromium
156.0.8078.79 completed 15 assertion groups with zero uncaught page errors.
The tested HTML SHA-256 is
`3e807fde7fb85a824751bdbbd22f50e5798687c6b8e520e3caa84d17889da307`.
There are 37 distinct screenshots. The complete catalog initially rendered 145
entries: 144 illustrated exercises plus the documented missing-illustration
definition. The synthetic custom definition was created later in the UI flow.

The MP4 contains 451 captured frames. Its duration is 12.249 seconds for 12.244
seconds of capture wall time; no playback acceleration or slow-down is applied.
Screenshots wait for the existing particle transition to settle. Selected
editor rows, actual weight/reps fields, and expanded history were visually
reviewed, including RU decimal commas in saved actual results.

Ten legacy Google Fonts requests were blocked by the test route. These produced
resource-blocked console messages; the local Sport Manrope and exercise images
rendered successfully. No external request was dispatched. At enlarged text,
long Spanish library-tab labels wrap within their buttons; controls remain
available and the page has no horizontal overflow.
