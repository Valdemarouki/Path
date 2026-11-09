# Functional Alpha working checkpoint

Baseline: Valdemarouki/Path /workspace/Path, feature/path-mobile-alpha, 3d80a0776b4519e0ebabdbd0088e15e0c26c1d64. Initial status clean. Desktop and old audits are read-only references. No remote/config changes.

| Section | Existing | Target scenario / dependencies |
|---|---|---|
| Today | Task lifecycle, main reference, overdue, event/habits | Add canonical project-task projections; retain lifecycle and midnight behavior |
| Calendar | Complete standalone event lifecycle + durable Undo | Preserve; show derived project deadlines and workout plans without copies |
| Quick Add | Task-only default | Task / event / note entry with dirty guard |
| Habits | Today's dated checkmarks only | Create/edit daily or weekdays completion schedule, dated history, archive |
| Sport | Unavailable | Template → snapshot plan → active sets/rest → immutable history; active reload recovery |
| Notes | Unavailable | Markdown-source note list/search/editor/trash/restore; complex documents read-only |
| Projects | Unavailable | Project + canonical nested tasks, deadline/status, Today/Calendar/Progress views |
| Canvas | Unavailable | Read-only coordinate/edge viewer, local pan/zoom, shared source opening; no graph writes |
| Progress | Unavailable | Period counts from actual local records; no fake charts |
| Profile | Unavailable | Honest local profile |
| Settings | Language + JSON export | Device motion preference + versioned mobile export; no unsafe import |
| Sync | Unavailable message | Local save/error state only, no server claims |

Implementation plan: mobile-only date/selectors + entity model; model tests while building; safe reusable editors and views; sport lifecycle; pure desktop staging adapter with round-trip tests; full browser workflows and visual/motion checks; commits, docs and external archive/bundle.

Confirmed desktop differences: projects use active/paused/completed; project tasks planned/progress/done (projects.js). Task views derive from deadline/workflow/event linkage (integration.js), not a copied homeTask. Sport actualValue has reps/seconds/kg unit (sport-smart-model.js), not an existing separate weight field; any optional simultaneous load must be documented as mobile-only. Notes body is Markdown source, not persisted HTML. Existing desktop audits: ../calendar-polish/AUDIT.md and ../compatibility/AUDIT.md.

Current work: all basic section flows and the pure staging adapter are implemented. 61 model tests and 33 Functional Alpha browser checks pass. The combined 14-suite regression passed before the final heading-focus/escaping checks were added; a final same-source run follows. Runtime schema is 5. Desktop-aligned types: note ISO dates, pausedAt epoch milliseconds, one-based set numbering. Notes/workout quota and stale-tab drafts are verified. Basic Canvas source projections update without graph writes. Visual captures/video completed in /tmp/path-alpha-visual-final (not yet copied into the report).

Next concrete steps: copy reviewed visual evidence and final validation logs to this directory, finish README/report + changed-file manifest, commit those files, export/verify source archive and Git bundle outside the repo, report final clean status. No further functional expansion. Commands: python3 mobile/build.py; python3 mobile/typography-preview/build.py; node mobile/tests/run-polish.cjs --evidence /tmp/path-functional-alpha-release-final --with-typography (servers 8010/8020); TZ=Europe/Warsaw MOBILE_ALPHA_VISUALS=/tmp/path-alpha-visual-final node mobile/tests/alpha-evidence.cjs.
