# Path Sport exercise illustrations

These exercise files were supplied by the Path owner in
`Path_Sport_Implementation_Package_2026-11-11.zip` for this local Sport work.
The original package and artwork were not changed. No separate copyright
license or medical endorsement is inferred from the supplied files.

Source archive: `04_ASSETS/Path_Exercise_Library_144_SVG.zip`.
SHA-256: `1f57dc1aa4aace03ddbfe6166d755477d54f7c7195e97c5b7a81ccf163177c90`.
Source root: `Path_Exercise_Library/`.

Only the 144 individually audited files under `svg/` were copied into this
directory. Each runtime SVG is byte-identical to its source. All illustrations
use a transparent 512×512 viewBox, compound vector paths, fixed `#EFEFEB` fill
and the original even-odd negative space. They depict static exercise poses;
they are not technique animations or medical guidance.

`catalogue.json` is the normalized runtime catalogue. Its 144 `entries` use the
exact source paths and new stable `catalog:<source-id>` definition IDs. Explicit
Spanish names and measurement types were added for the application. Existing
user definition IDs and per-workout exercise-slot IDs are not renamed.

The separately listed supplemental Scapular pull-up has no supplied image:
`missingDefinitions` contains its metadata, with `assetKey`/`path` set to null.
It does not increase the supplied SVG count. Unknown or custom definitions also
use the application's accessible placeholder until explicitly mapped.

The body-map geometry is supplied separately in `domain/sport-body-map.js`,
extracted without changing the silhouette from `03_REFERENCES/Path_Sport_Concept.html`.
Concept SHA-256: `e955d34cfda98f7dd5608238b86a03076f35322e937b6377b8983194d2a92c68`.
Google Fonts, widget-state integration and concept-only dependencies were not
copied. Path continues to use its own local fonts, persistence and controls.

Source PNGs, contact sheets, galleries and audit artifacts are excluded from
runtime assets. The repeat audit, ID/path map and authored-metadata inventory
are documented in `docs/sport/ASSET_AUDIT.md`.
