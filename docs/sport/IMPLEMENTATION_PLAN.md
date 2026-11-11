# Sport implementation — compatibility contract before edits

11 November 2026, Europe/Warsaw. Existing working copy `/workspace/Path`,
`feature/path-mobile-alpha`, clean baseline
`7d0fe19be5f7807505adc99afd5b630e04e8df0f`. The old SHA mentioned in the material
is historical; no reset, clean, branch replacement or new worktree is planned.
The user's current instruction authorizes Sport on both platforms and the
minimum necessary model, validator, localization, adapter and build integration.
Protected branches, AGENTS, accounts, production, Paperclip and publishing remain
outside this task. All verification uses synthetic profiles.

## Current-code audit

| Responsibility | Present | Adapt / missing |
| --- | --- | --- |
| Desktop programs/templates | `sport.js`, `sport-programs.js`, `sport-schedule.js`, `workout-builder.js` | Compact editor, archive/duplicate controls, verified library and illustrations |
| Desktop execution/history | `sport-smart-model.js`, `sport-smart.js`, `sport-flow.js`, `sport-history.js` | Structured results; library-backed detail/current-exercise views; preserve existing skills/progression |
| Mobile templates/session/history | Sport branches of `mobile/alpha-model.mjs` and `mobile/alpha-ui.mjs` | Programs, catalogue, typed fields, durable unsaved inputs and idempotent set logging |
| Calendar link | Shared `events`, `workoutTemplateId`, `plannedSnapshot` on both | Sport-specific stable-ID retime and source-event navigation, without loosening unrelated event protection |
| Persistence | Desktop `PathRepository`; native mobile clone/validate/write plus app Web Locks | Reuse existing transactions, rollback, Undo and conflict reporting |
| Mobile desktop-test | `desktop-adapter.mjs`, `desktop-inspector.mjs`, `desktop-test-repository.mjs` preserve canonical checkpoints | Confirmed Sport commands; currently all Sport actions are read-only |
| Catalogue/map/assets | No 144-exercise catalogue in current app | Whitelisted local SVGs, explicit metadata, approved body geometry, accessible text filters |

Affected owners are being read in full before modification. Desktop assembly
order is significant: older render wrappers and document handlers must not be
shadowed by another competing interaction layer. Native storage and the
desktop-test storage namespace remain separate.

## Additive model contract

Use the existing `programs`, `workouts`, `events`, `activeWorkout` and
`workoutRecords` collections. No parallel Sport database or `shared/` directory.
A common pure engine in the existing `domain/` directory is called inside each
platform's existing transaction. It has no storage, DOM or network access.

- Programs retain `id`, `name`, `description`, `workoutOrder` and `archived`.
  Existing unknown fields and IDs survive every requested edit.
- Workout templates remain `workouts` with `programId` and ordered `exercises`.
  A slot has its own `id`; a duplicate keeps the definition reference but gets
  a new slot ID. New catalogue definitions use `catalog:<catalogue-id>` and an
  explicit `assetKey`. Existing definition IDs are never replaced by a name
  match. Unknown/custom definitions remain usable with a labelled placeholder.
- Optional slot fields describe `measurementType`, `targetValues`, `variant`,
  `assetKey` and notes. Types are `reps`, `weightReps`, `seconds`, `duration`,
  `distance` and legacy `weight`. Numeric actuals are separate fields of an
  `actual` object: `reps`, `weightKg`, `seconds`, `distanceMeters`, as appropriate.
- New sessions/results use `sportVersion:4`. The legacy `result`, `actualValue`
  and unit fields retain their meanings as a compatible primary projection;
  they are not used to smuggle two measurements into one value. Existing `kg`
  means weight only. Actual repetitions are never inferred from a target.
  Explicit new distance fields use `meters`, with corresponding validation.
- Existing v3 desktop and v1 native snapshots/history are preserved. No mass
  conversion, identity rewrite, stripping of unknown properties or destructive
  schema migration is permitted. New optional fields are validated separately;
  existing envelopes and storage keys are retained.
- New history records contain real logged sets only, the immutable template
  snapshot and enough planned-count/status information to distinguish partial
  from complete work. Existing records are not rewritten. An empty finish
  creates no result. Idempotent operations retain stable command/session/set IDs.
- Raw unfinished input is saved as a draft, separately from validated actuals.
  Invalid/incomplete typing must remain recoverable without becoming a logged
  set. Local success feedback follows the durable write, never precedes it.
- Library preferences/custom definitions are an optional namespaced extension,
  `sportsLibrary`; strict existing `exercisePreferences` entries remain valid.
  Catalogue payloads are packaged assets, not 144 duplicated stored records.

Commands are prepared with explicit IDs and timestamp context before applying
them. The same deterministic command is applied to the transaction candidate
and, in desktop-test mode, the canonical checkpoint. The adapter verifies the
allowed changes and keeps complete source records separately from projections.
The test mode must never access the native mobile storage key.

Calendar normalization stays with the existing platform Calendar functions.
Sport scheduling/retiming then attaches the stable template reference and a
copied planned snapshot to the same event. Opening a program or Schedule panel
has no event side effect. Plain Calendar completion never invents actual sets.
Session timers use timestamps, retained pause/rest state and the app/system
timezone. Comparisons require matching measurement type, units and conditions.

## Material discrepancies resolved for implementation

Outer package hashes pass 20/20. The repeated archive audit finds 192 files,
144 structurally valid SVGs in 12 categories, totaling 2,791,504 bytes. Runtime
includes only verified SVGs, explicit catalogue metadata and body geometry;
source PNGs, contact sheets and demo HTML are excluded.

Scapular pull-ups has no supplied SVG and uses an honest placeholder. The four
unmapped groups `adductors`, `hipflexors`, `hiprotators`, `neck` remain available
as text filters and are included by Full body. No other body region is used as
a substitute. Preset union does not clear explicit manual exclusions. Missing
measurement types and ES names are supplied explicitly; secondary muscles are
not invented. Supplied silhouette details are retained rather than destructively
editing their compound paths. No medical accuracy or technique animation claim.

The package's statement that iOS is unknown is historical: the user supplied
iPhone 12 Pro / iOS 26.6.1 / Safari earlier. Automated browsers are not that
physical device or an installed Windows application.

## Planned files and verification

Desktop Sport owners (`sport*.js/css`, `workout-builder.js`), additive
`storage.js` validation, common `domain/sport-core.js`, catalogue/body-map
modules and `assets/sport/`; mobile Sport model/UI/i18n/style modules and
minimal route/adapter integration; the two build scripts and necessary locale
entries. Root configuration, lockfiles and unrelated screens are not redesigned.

Tests cover old-data preservation, typed results, preset exclusions, IDs,
Calendar one-event semantics, transaction failures/conflicts, double taps,
draft/reload, midnight/timer, actual history and canonical desktop export.
Browser acceptance covers the complete chain on desktop and native/test mobile,
EN/RU/ES, 320/360/390/430, landscape, 1366×768/1920×1080, keyboard/large text and
reduced motion. Deliver local Windows-ready files, phone instructions, evidence,
source archive, Git bundle and hashes, with actual platform limitations stated.
