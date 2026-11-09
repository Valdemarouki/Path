> Latest Calendar functionality and schema 3: [compatibility stage](../compatibility/README.md). Earlier milestone descriptions below are historical.

# Calendar importance variations

Read-only desktop references: calendar-importance.js and calendar-importance-refinement.css. Desktop uses none/low/medium/high with progressively brighter graphite, a more visible contour, and a 0/1/2/3px left accent (#696a6d, #a8aaae, #f0f0ef). Mobile now follows that hierarchy while retaining the approved opaque gradient/noise material, card sizes, Manrope 400 and quiet contours without strong glow.

All four levels have localized text labels, so importance is not conveyed only by subtle tonal differences. Completion keeps the level/stripe and independently mutes/strikes the title. Free-time events show no importance, matching desktop's exclusion. Unknown/missing values safely render none; stored records are not normalized or rewritten.

The source remains the existing event.importance field. There is no mobile project-task linking/priority picker or event editor; desktop linked-project-task precedence is not imported. This is a display change, not a new editing or model feature.

Validation: static build; nine dedicated browser cases (320/390/430 × EN/RU/ES), plus the nine existing card-surface regression cases. Tests verify levels/stripe widths, local-language labels, title weight 400, no event blur, completion independence, free-time exclusion and no horizontal overflow. Fresh synthetic browser profiles, non-loopback traffic blocked. Physical phones/Safari remain untested.

Screenshots levels-{en,ru,es}-{320,390,430}.png show identical event titles across the four levels for direct comparison. Existing model, navigation and desktop sources are unchanged. No remote Git operation, production, Paperclip or Daytona access.

Reproduce with the usual local mobile server running on 127.0.0.1:8010:

```sh
node mobile/tests/event-importance.cjs
MOBILE_CALENDAR_EVIDENCE=/tmp/path-importance-regression node mobile/tests/calendar-cards.cjs
```
