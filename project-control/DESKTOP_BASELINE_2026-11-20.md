# Desktop baseline — 20 November 2026

The current GitHub desktop version has been checked in a separate development
checkout, providing a reproducible starting point for work in this chat and
subsequent Paperclip review.

## Revision

- Repository: `Valdemarouki/Path`.
- Base branch: `paperclip-test`.
- Tested commit: `72048721f25f2acb2d34528a3dbc449320437efb`.
- Local development branch: `work/chat-desktop-baseline`.
- Environment: Linux; Node.js `v24.22.3`; Git `2.56.1`.
- The base includes merged PR #15, Calendar gestures, bounded completion motion
  and final fidelity, integrated by Paperclip on 18 November 2026.
- The checkout was clean before and after validation. Generated build outputs
  are ignored by Git. This report is the only source-controlled addition.

## Validation

Run these commands from the repository root, in the listed order. All eight
commands exited with status `0` on the tested commit.

| Command | Result |
| --- | --- |
| `python3 build.py` | PASS — standalone interface and syntax-check files generated. |
| `node desktop/prepare.cjs` | PASS — desktop HTML and script hashes prepared. |
| `node desktop/check.cjs` | PASS — packaged HTML, both script hashes, desktop identity, and absence of inline HTML event handlers. |
| `node project-control/check-storage.cjs` | PASS — atomic writes/history, restart Undo/Redo, write failures and retry, stale-window protection, legacy/corrupt-data protection, recovery import, and UUID fallback. |
| `TZ=Europe/Warsaw node project-control/check-habits.cjs` | PASS — migration, independent dated check-ins, undoing a check-in, persistence, and Warsaw midnight in summer/winter. |
| `node project-control/check-recurrence.cjs` | PASS — daily/weekly series, date boundaries, IDs, independent snapshots, occurrence edits/cancellation, Undo/Redo, and invalid-write protection. |
| `node --check check0.js` | PASS — main generated script syntax. |
| `node --check check1.js` | PASS — generated module script syntax. |

These checks use synthetic in-memory test data and local build files. They do
not require a running web server, accounts, or a connection to production.

## Scope and limits

This is an initial build and model baseline, not a full application acceptance
test. No product defect was reproduced by these checks. Browser interaction,
Windows/Electron launch and installation, physical iPhone/Safari behavior,
and real synchronization were not tested in this run.

The remote branch listing contained `paperclip-test` and `qa-image-build` at
inspection time. `feature/path-mobile-alpha` was not present. Mobile work
requires its actual source branch or Git bundle; it cannot be inferred from
desktop code or screenshots.

The GitHub open-PR query returned no open pull requests. The Paperclip service
and active agent workspaces were not inspected. This result does not establish
that no agent has local or unpublished work, including the Sport task PAT-84.

## Handoff information

For the next concrete task, record its starting commit, touched modules,
validation results, and resulting commit. Before combining it with Paperclip
work, compare the current shared branch with that starting commit and account
for intervening changes. A recipient needs the actual commits through an
authorized remote branch or Git bundle; local commits alone are not a transfer.

This baseline does not authorize publishing, merging, deployment, or changes
to the Paperclip service. Existing project instructions and the owner's
task-specific directions continue to apply.
