> Historical preview evidence. The subsequent task-lifecycle stage adopts the chosen Manrope roles; see ../tasks/README.md. These original screenshots/reports are retained.

# Today — Manrope 200 preview

Scope: new standalone mobile typography preview only, not a final migration. Existing application, navigation, desktop files and root settings remain unchanged.

Six primary screenshots: en/ru/es at 320×844 and 390×844 CSS pixels. Each includes the localized heading, a deliberately long synthetic task and bottom navigation. `en-390-card-200.png` is the optional lighter card-heading variant; `quick-add-en-390.png` shows fields and primary action typography.

Default weights: large headings 200, card headings 300 (optional 200), body/fields/date/navigation 400, primary actions 500. Today uses 56px at 390 and 50px at 320; the original heading line-box is retained. Long task wrapping may naturally increase card height.

Verification: 26 browser cases passed. Actual rendered glyphs in headings, long task titles, dates and navigation were inspected with Chromium CSS.getPlatformFontsForNode: local custom Manrope only, no fallback. All requests remained local. Full Russian alphabet including Ёё and Spanish accented characters/¿¡ are present in the actual font cmap. Real variable outlines at 200/300/400/500 are distinct; no synthetic style.

Checks also cover all six language/width combinations, no horizontal overflow, navigation tap targets ≥44px, surface/background/border/radius/padding/shadow/blur equality with production, identical normal panel bounds, synthetic task completion and reload persistence, isolated preview storage, reduced-motion navigation and no browser errors. This is Chromium verification, not a claim of physical-device Safari testing.

See browser-verification.json and font-verification.json. License and provenance are bundled under mobile/typography-preview/fonts and documented in its README. Main task intentionally has a long title to expose wrapping; production data is untouched.

No GitHub writes, deployment, environment publication, Paperclip or production access. Local files/commits are not an external backup; persistence beyond this workspace has not been independently verified.
