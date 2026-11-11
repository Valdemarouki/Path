# Sport material and asset audit

11 November 2026, Europe/Warsaw. The supplied main implementation prompt,
original requirements, audit and acceptance document were read in full. This
repeat audit concerns materials and runtime metadata; it is not a physical
iPhone, installed Windows or integrated Sport acceptance result.

## Inputs and repeated checks

The outer package's `SHA256SUMS.txt` passed for all **20 listed files**.
The nested exercise archive passed CRC, duplicate-name, path traversal and
symlink checks before extraction. It contains **192 files plus one directory**.
The supplied `audit_assets.py` was read before execution and run against the
unmodified archive and concept. The resulting summary exactly matches the
supplied summary.

| Check | Repeated result |
| --- | --- |
| Catalogue definitions / unique IDs | 144 / 144 |
| Categories | 12, each containing 12 exercises |
| SVG assets / matching catalogue paths | 144 / 144 |
| Missing / unreferenced SVGs | 0 / 0 |
| SVGs containing actual vector paths | 144 |
| Image, script, foreignObject, active handlers or external references | 0 |
| ViewBox | All `0 0 512 512` |
| Fills / fill rules | All `#EFEFEB`, `evenodd` |
| Combined SVG size | 2,791,504 bytes |
| Per-file sizes | 11,778–31,881 bytes |
| SVG-title / catalogue-name mismatches | 0 |
| Duplicate catalogue or cross-file internal IDs | 0 |

Nine actual SVGs were rendered again at 256×256 using the environment's
existing Inkscape and reviewed: pull-up, chin-up, push-up, parallel-bar-dip,
bodyweight-squat, reverse-lunge, inverted-row, hollow-body-hold and forearm-plank.
All nine rendered successfully, have transparent corners and have alpha bounds
strictly inside the canvas. This is a representative review, not an anatomical
certification of all 144 poses. The original poses include fine face/hair and
internal cut-out detail despite the original requirements' abstract no-face
wording; the supplied verified paths were preserved instead of destructively
simplified. Precise text labels remain essential at small sizes and for grips.

## Reconciled gaps

- **Scapular pull-up:** no source SVG. A separate selectable supplemental
  definition uses a null asset path and an accessible placeholder. It retains
  its actual name and explicit repetitions type; no muscles are invented.
- **Map coverage:** the approved map has 15 groups. `adductors`, `hipflexors`,
  `hiprotators` and `neck` occur in 19 source entries but have no separate map
  region. All 19 IDs remain available as textual filters. Full body includes
  every group; no neighboring region is highlighted as a substitute.
- **Manual exclusions:** the concept-only six-case check reproduced five
  passes and one documented mismatch. The supplied concept clears exclusions
  when enabling a preset. Runtime focus helpers preserve an explicit exclusion
  until the user selects that muscle again or resets the focus.
- **Missing metadata:** none of the 144 source entries supplies a measurement
  type, Spanish name or secondary-muscle list. Spanish names and typed
  measurement choices are explicitly authored for each definition; secondary
  muscles remain unspecified. No type is inferred from a picture or name at
  runtime. Original `pose` metadata is an English visual description, not
  localized training guidance.
- **Historical context:** statements in the supplied preparation audit about
  an unavailable repository or unknown iOS describe that earlier audit context.
  They do not authorize a rollback, replacement checkout or access to real data.

## Runtime identity and rendering

`assets/sport/catalogue.json` contains `entries` (144 source definitions),
`missingDefinitions` (the supplemental Scapular pull-up), `muscles`, `equipment`,
`categories`, `presets` and source hashes. Each source entry has an explicit
`assetKey` and canonical `path`; the module data is generated from this same
normalized document and checked for equality.

New definitions use `catalog:<source ID>`. An exercise position within a workout
still needs its own distinct slot ID. Existing user IDs are preserved: the old
desktop library derives definitions from stored workout rows using an explicit
`definitionId` or `exercise:<slotID>`. There is no safe universal conversion of
those IDs by visible name. A definition is resolved only by explicit identity
or asset-key fields. `DEFINITION_ASSET_MAP.json` records every new mapping.

`PathSportCatalog.entries` exposes the 144 source definitions; `.list` and
`.filter()` include the supplemental placeholder definition as well. The
catalogue contains explicit `reps`, `weightReps`, `seconds`, `duration` and
`distance` choices. `weightReps` uses primary unit `reps` and separate
`weightUnit:kg`; it does not reinterpret old weight-only `kg` results. Distance
uses `meters`, duration/holds use `seconds`. Legacy weight-only behavior remains
the existing model's responsibility.

The whitelist lookup returns a local SVG path for mobile. Desktop may provide
the same validated bytes through `PATH_SPORT_ASSET_DATA[assetKey]`; only SVG data
URLs are accepted by that branch, avoiding any required external image host or
CSP-policy change. The definition's canonical source path remains unchanged.
The UI uses image elements with lazy decoding/loading, not 144 raw inline SVGs.
Missing and unknown definitions return null for the UI's accessible placeholder.

`PathSportBodyMap` preserves the exact supplied smooth silhouette and mirrored
front/back paths, viewBox `0 0 200 460`. Its generated markup uses only trusted
geometry and escaped text; it has no storage, network, fonts or widget hooks.
Interactive paths expose `data-sport-muscle` and `data-muscle`; the UI supplies
the required accessible muscle-button list in addition to small map regions.

## Reproduction and evidence

Source materials are kept outside the repository at
`/workspace/path-sport-package-2026-11-11`. Audit output is recorded under
`docs/sport/assets-audit/`, including source manifest, summary, hash checks,
explicit definition/asset mapping, authored metadata, representative renders
and the known concept-only filter mismatch. The upstream manifest's null
`existing_app_definition_id` is retained faithfully; the application's new
mapping is recorded separately, without claiming old user IDs were matched.

```sh
python3 /workspace/path-sport-package-2026-11-11/05_AUDIT/audit_assets.py \
  /workspace/path-sport-package-2026-11-11/04_ASSETS/Path_Exercise_Library_144_SVG.zip \
  /workspace/path-sport-package-2026-11-11/03_REFERENCES/Path_Sport_Concept.html \
  /tmp/path-sport-materials-audit/repeated
node /workspace/path-sport-package-2026-11-11/05_AUDIT/check_focus_concept.cjs \
  /workspace/path-sport-package-2026-11-11/03_REFERENCES/Path_Sport_Concept.html \
  /tmp/path-sport-materials-audit/REPEATED_FOCUS_CONCEPT_CHECKS.json
```

The second command intentionally returns 1 for the supplied concept's known
mismatch; it is not a failure of the corrected runtime model. The 28 PNGs,
source sheets, gallery, original archives and audit artifacts are excluded from
runtime packaging. No dependency was installed, listener opened, remote source
contacted or user data read during this audit/import.

The checked-in runtime audit also runs without a browser or listener:

```sh
node docs/sport/assets-audit/verify-catalog.cjs
```

All **16 groups passed**: source/runtime hashes and JSON equivalence; unique
definitions; all three name locales; explicit measurement/unit choices; honest
placeholder and legacy-ID lookup; independent preset/manual selections;
preserved exclusions; full 19-group coverage; combined multilingual search and
filters; validated embedded-data lookup; exact immutable map geometry; escaped
rendered labels; and classic-script loading without CommonJS or concept hooks.
Results are recorded in `assets-audit/RUNTIME_CHECKS.json`. Source type choices
are 39 repetitions, 67 paired weight/repetitions, 25 holds, 7 distances and 6
durations; these are explicit application defaults, not medical recommendations.
