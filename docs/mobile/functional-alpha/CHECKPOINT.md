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

Current work: implementation complete and stopped. Four local implementation commits: 553ffda778d2668804e21fce9337fcf406a46690, bff3e7a13ec83f38f05af163b357ff2d52e1c854, a8f438c19861e6b6b3a4fa7fb8b45027f30c02d7, 160e1cbfc6919f5c21f11e1caf0f4b84cb2d1a18. All 14 suites pass; latest counts 63 model + 34 functional flows/matrix + other suites = 402 unique cases (mixed granularity). Final focused reruns after preservation guards passed, including prevention of stale-editor resurrection. Build passes. Evidence, 135 matrix screenshots, real 12-second video and logs are in this directory. Source changes confined to mobile/ and docs/mobile/; no remote writes or environment publication.

Remaining handoff operations only: commit docs/evidence/manifest, run python3 mobile/package.py, verify hashes + fresh extracted-source build + temporary bundle restoration/fsck outside repo, report clean final status and actual paths. Do not continue feature work. Artifacts are local to this environment; no chat attachment export tool or external durability is verified. Browser localStorage is separate from Git/source archive. See README.md and COMPATIBILITY.md for behavior, limitations, run commands and future priorities.
