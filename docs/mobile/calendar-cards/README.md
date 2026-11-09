# Calendar event-card material

Baseline: feature/path-mobile-alpha d125b6ba1989cf91220d25ffca5eae98811e8562, clean working tree. Scope is mobile Calendar list presentation only.

Events remain in the existing day list, sorted/filtered by the unchanged eventsOnDay model. There is no temporal grid: a five-minute event gets readable content-driven height without implying a time-axis measurement. Cards use 22px radius at 320px, 24px otherwise, 16/18–20px padding and 12px gaps. The opaque diagonal graphite gradient runs #272729 → #202022 → #19191b, with a dark 1px edge and weak inset top highlight. Cached monochrome panel-noise.svg appears in a noninteractive pseudo-element at opacity .018 behind content; no texture filter is applied to text/icons, and no backdrop blur is used on events.

Title/time are local Manrope 400, at 16/17px and 12px respectively. Titles wrap completely. Existing type values get small outlined glyphs and localized labels (busy/workout/routine/deadline/focus/free_time; unknown values use the generic event presentation). Existing importance low/medium/high gets a restrained neutral text label, with no colored fill. The existing done flag gets a Completed label/check and a muted strikethrough title. No records, IDs, instants, dates or values are changed by this presentation.

Pressed surface changes only the gradient, without translation, scale or geometry changes. Keyboard-focusable article cards retain a visible focus-visible outline. They have no button role or fake editing action.

## Explicit missing functionality

The inspected mobile app has a task editor only. There is no existing mobile event editor or handler to invoke; the desktop modalEvent is not imported or executed. Therefore the requested click-to-open-event-editor behavior could not be connected while retaining the present Calendar behavior. A new editor was not invented during this styling change. Selection is not implemented and no selected state is fabricated. Completed styling reflects existing data; event completion controls remain outside this stage.

## Evidence and checks

- Static mobile build: PASS.
- Calendar-specific browser test: 9 PASS (320/390/430 × EN/RU/ES), reduced motion, long title wrapping, 3 consecutive events, 5-minute event, existing done/importance, opaque gradients/no blur, actual configured title/time weight 400, keyboard focus, unchanged adjacent geometry while pressed, unchanged serialized storage and no browser exceptions. Fresh disposable contexts only; all non-loopback requests blocked.
- Existing browser regression: 55 PASS. Existing + task model tests: 18 PASS.
- model.mjs, navigation.css/navigation.mjs/styles.css remain byte-identical to baseline. No existing desktop/root files are changed.

calendar-{language}-{width}.png are full-page screenshots; examples-{language}-{width}.png show just the three event cards. Their completion/importance values are synthetic fixtures injected by tests, not newly added user controls. No selected-state screenshot is claimed.

Reproduce using Python 3 and the environment's existing Playwright/Chromium:

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
# In another terminal:
node mobile/tests/calendar-cards.cjs
MOBILE_EVIDENCE_DIR=/tmp/path-calendar-cards-regression node mobile/tests/browser.cjs
node --test mobile/tests/model.test.mjs mobile/tests/tasks-model.test.mjs
```

Physical iOS/Android and Safari have not been tested. No dependency installation, environment configuration/publication, account/production API, Paperclip/Daytona access, GitHub write or deployment is involved.
