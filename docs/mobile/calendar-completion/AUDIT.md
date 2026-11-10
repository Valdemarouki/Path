# Calendar completion: read-only desktop audit

Baseline: Valdemarouki/Path, /workspace/Path, feature/path-mobile-alpha, clean at 6f5ef645c45975847818063264d509db3b45d846. Desktop files are references only. No desktop build or service was run.

Actual load order is confirmed in build.py: calendar-pulse.js → motion-master.js → path-pulse-360.js. The latter overrides the earlier calendarPulse. Do not copy the obsolete 520 ms/320 px implementation as the current effect.

| Source | Confirmed behavior |
|---|---|
| calendar-pulse.js:startCalendarHold / calendar-pulse.css | 800 ms hold; rounded rectangle pathLength 100, dash offset 100 → 0, linear; early release cancels; short click opens existing editor; Shift+Enter completes |
| calendar.js pointer interaction | 7 CSS px drag threshold; desktop captures pointer and prevents default for drag/resize |
| motion-master.js commit wrapper/render | Completion notifications originate only from successful persistence, then current Calendar feedback executes |
| PATH_PULSE_360_CONFIG_v6_1.json | 800 ms charge, force 125%, radius 560 px, central return 850 ms, neighbor return 1060 ms, highlight fade 1010 ms, distance stagger max 410 ms, no reverse overshoot |
| path-pulse-360.js:pathPulseResponse | Attack phase .19; return curve k=6.4, normalized exponential decay |
| path-pulse-360.js:run | Current Calendar pulse scales source and translates/rotates neighboring elements; this conflicts with the owner's explicit mobile constraint |
| path-pulse-360.js:todayWave / motion-master.css:.today-pulse-ring | Existing Path ring: scale .025/.13/.62/1 at offsets 0/.12/.55/1, opacity 0/.65/.25/0, cubic-bezier(.16,.6,.3,1); monochrome transparent ring/glow; desktop Today duration 900 ms |
| PATH_MOTION_CONFIG.json / motion-master.js:check | 565 ms check, scale .28/1.32/.89/1.055/1, offsets 0/.35/.67/.85/1, rotation -9/2/-1/.5/0 degrees; undo 180 ms |

Mobile plan: keep 800 ms and contour/check character. Keep native pan-y/pinch-zoom, no pointer capture or down/move preventDefault. Cancel at 7 px, pointer cancel, scroll, blur, background and route/date/render change. A <=200 ms stationary tap opens the editor; a partial hold above that tap window cancels with a 180 ms contour return. Do not move neighboring cards or the nav. Render the existing shared Path ring and the Calendar impulse/brightness profile in a disposable clipped overlay, using Calendar timing and a 560 px propagation radius. This is an explicit adaptation, not a claim that current desktop Calendar already renders that ring.

Preserve linked/series/workout protections. Only supported standalone non-Free-Time/non-deadline events can be completed with this gesture. The editor remains the accessible completion/uncompletion path. No schema migration or account/sync changes.

Implemented in mobile/calendar-completion.mjs and .css. The done mutation changes no other event fields. The root commit retains the existing Web Locks / repository conflict check and only skips the full list render for this interaction. A queued gesture rechecks its context immediately before writing. Failed writes keep old bytes and in-memory state; Retry/Refresh are explicit. The editor and Shift+Enter use the same completion feedback after a successful write.

The completed-status slot is reserved before completion (hidden and aria-hidden while pending), preventing card height and scroll changes. The accessible description includes time, type, importance and the completed state. Undo in the notice or existing editor is calm and does not emit another pulse. Keyboard focus remains visible and returns to an available notice action if its former action disappears.

No permanent requestAnimationFrame or animation loop was added. The transient ring/echo layer owns a finite cleanup animation, including delayed echoes. Gesture cancellation, actual window blur/background, motion preference changes, date/route/render changes and page scrolling remove transient layers. Ordinary element blur is intentionally ignored. The layer is clipped to the visible agenda above the nav; no card, page, text or nav is transformed by it.

Verification and the real browser compositor recording are documented in REPORT.md. Physical phone testing remains a separate validation step; no device claim is inferred from Chromium emulation.
