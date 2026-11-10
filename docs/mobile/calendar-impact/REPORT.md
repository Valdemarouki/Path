# Calendar completion — impact

Baseline: `/workspace/Path`, `feature/path-mobile-alpha`, clean at `2f257dc99a3b5bbdf2562df4286eb2e6940315d3`. The owner now explicitly permits temporary visual displacement of neighboring cards. This report supersedes the earlier prohibition recorded in `../calendar-completion/REPORT.md`; that report remains historical evidence of the preceding stage.

## Desktop source, read only

The actual loaded implementation is **path-pulse-360.js**, overriding the earlier `calendarPulse`. Sources read: `pathPulseVector`, `pathPulseResponse`, `PathPulse360.run`, `calendarPulse` and `PATH_PULSE_360_CONFIG_v6_1.json`.

| Mechanism | Desktop | Mobile adaptation |
|---|---|---|
| Impulse origin | Completed card centre | Same; one-column neighbors move vertically, multiple columns use both axes |
| Direction | Normalized `(dx,dy)` away from source | Same radial vector; no card rotation |
| Attenuation | `(1 − distance/560)^.9`, force 125%, horizontal bias up to 1.43 | Same law, force and bias |
| Amplitude | Base 34 CSS px, cap 31 px | Base 14 px, cap **14 px**, additionally bounded to viewport with 4 px margin |
| Arrival delay | `round(distance/560 × 410)` ms | Same; ring reaches radius 560 px in 410 ms so its front and vector delays agree |
| Outward response | Sine attack, phase .19 | Same curve with attack phase **.14** of 820 ms: approximately **115 ms** to peak |
| Return | Normalized exponential, k=6.4, 1060 ms; v6.1 has no reverse overshoot | Same exponential character, shorter **820 ms** total; one reverse lobe required by the new instruction |
| Reverse excursion | v6.1 reverseOvershoot 0 | Exactly one, maximum **12%** of the outward displacement; smooth zero-velocity stop |
| Source | .98 → 1.03 → 1.012 → 1.003 → 1, 850 ms | 1 → .99 → 1.018 → .997 → 1, offsets 0/.08/.24/.72/1, **520 ms**; expansion capped at edges |

The reverse lobe is an intentional change requested by the owner, not attributed to desktop v6.1. No tremble or neighbor rotation was copied. No flash brightness was increased. The existing graphite, noise, typography and transparent navigation CSS remain untouched.

The contour still fills over **800 ms**, the check still uses **565 ms**. The Path ring uses the existing monochrome material, with linear expansion to 560 px over 410 ms, then a **250 ms** fade (660 ms total, final radius 604.8 px). Its opacity peaks at .65, as before. Subtle existing outline echoes follow the same displacement as their cards instead of staying behind at the original positions.

## Paint only, stable model and interaction

`mobile/calendar-impact.mjs` contains pure, copied/adapted geometry and response functions. `calendar-completion.mjs` invokes them only after successful local persistence. No events, dates, order, heights, gaps, stored positions or schema were changed for the effect.

Neighbors use WAAPI **independent `translate` with `composite:add`**. The source uses an additive scale transform. This composes with author transform/translate and another animation of the same property, without writing inline transform values. Each owned animation has a `calendar-impact-*` ID. Only owned animation handles are cancelled; other animations survive.

One pulse owns a finite set of animations. Starting another hold, undoing, scrolling, changing date/route, opening an editor, losing foreground or changing motion preference clears it. Pulses do not sum or leave residual transforms. There is no idle animation loop, no full-page input lock and no DOM clone with duplicate accessible controls.

Cards are real elements outside the visual ring layer; the ring layer's clipping cannot crop their displacement. Independent motion is bounded against the viewport, including the reverse excursion. The ring/outline overlay includes a 14 px allowance around the agenda and stops above the nav. Header, picker, agenda container and nav are never transformed.

OS reduced motion and Path Motion Off retain the hold indicator and saved-state change, without source/neighbor displacement or a large ring. A failed local save produces no successful impact. Undo remains a calm state change. Normal tap, native vertical scrolling, editor access and keyboard alternatives remain intact.

## Verification

**17/17 mobile suites passed**, including 72 unit checks of models/geometry, 31 existing completion scenarios and 13 new impact scenarios. The stronger final impact run also passed all 13, including another WAAPI translate effect composed with the impact and a real touch opening another editor during the moving phase.

New browser checks cover:

- A five-event synthetic day, completing the middle event at 320/390/430 px; two neighbors above and below, distance-dependent arrival and strength, one reverse excursion, exact return.
- Per-frame invariants: offset layout, width/height, order, inline styles, scroll position and scroll extents; unchanged header, picker and nav rectangles; no horizontal overflow.
- Persistence changes exactly `done` and one revision; unknown fields and IDs stay intact.
- Author transform/translate, a separate translate effect and an unrelated running animation survive.
- Radial geometry in a test-only two-column layout; this does not add a new Calendar layout feature.
- System reduced motion (RU at 320 px), Path Motion Off, quota failure/retry, undo/re-complete and fast neighboring completions.
- Editor input while impact is active, date/route cancellation and a source 5 px from the top edge.

In the final 390 px recording, peak measured displacement was approximately **13.72 px** for nearest neighbors and **10.00 px** for farther neighbors; reverse excursions were **1.64 / 1.20 px**. Near/far onset above a .35 px measurement threshold was **110 / 208 ms** after the successful write. Frame sampling adds up to a frame of quantization. All cards returned exactly to their starting visual rectangles and author styles.

`calendar-impact-1x.mp4` and `.gif` show the **ordinary-speed** compositor recording, not generated stills. The half-speed video is optional supplementary viewing. The small top caption is a test annotation and is absent from the product. `motion-samples.json` preserves frame measurements; `verification.json` includes scenario results and parameters. `regression-summary.json` and `test-results.txt` contain the broader test results. Everything uses disposable profiles, synthetic fixtures and localhost; other browser requests are blocked.

Physical iOS/Android, VoiceOver/TalkBack and performance on a low-end phone remain unverified. Browser emulation is not a physical-device claim.

```bash
cd /workspace/Path
python3 mobile/build.py
python3 mobile/typography-preview/build.py
# Separate terminals, if not already running:
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
python3 -m http.server 8020 --bind 127.0.0.1 --directory mobile/typography-preview/dist
node mobile/tests/run-polish.cjs --evidence /tmp/path-impact-regression --with-typography
MOBILE_IMPACT_EVIDENCE=/tmp/path-impact-final node mobile/tests/calendar-impact.cjs
```

Implementation commit: `9ecca6ba3d94165dfb674b1d36ecd9d9e6ef5664` — `mobile: add radial Calendar impact and bounded spring return`. A separate evidence commit is listed in the final response.

Complete project change list: `CHANGED_FILES.txt` (22 paths). Only mobile implementation/tests/build-copy lists and mobile documentation changed. Desktop, AGENTS.md, root settings, lockfiles, Paperclip, production and existing user data were not modified. No GitHub writes, push, PR, merge, deployment or environment publication were performed. Local commits remain local; they are not an external backup or a guarantee against loss of this environment.
