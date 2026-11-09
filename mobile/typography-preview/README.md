> Superseded as an experiment by the functional task stage: Manrope is now adopted in mobile/typography.css. This separate build remains available, with isolated storage and the optional card-weight comparison. Historical evidence is retained unchanged.

# Manrope typography preview

Experimental Today preview only. Production source files are unchanged. This implements the latest Manrope request, superseding the earlier decorative A/B/C comparison. No global typography migration has been approved.

Build and launch from the repository:

```sh
cd /workspace/Path
python3 mobile/typography-preview/build.py
python3 -m http.server 8020 --bind 127.0.0.1 --directory mobile/typography-preview/dist
```

Open http://127.0.0.1:8020 locally. The build copies production assets to an ignored dist folder and adds a font-only stylesheet. Its copied model uses the separate `path-mobile-manrope-preview-v1` storage key and synthetic data. Existing application storage is not imported. The preview includes existing screens, but it is not the final application typography change.

Typography: main headings 200; Today 56px at 390px and 50px at 320px, with the original header line-box heights retained. Card headings default to 300; `?card-weight=200` previews 200. Body, fields, dates and navigation use 400; primary buttons use 500. Font synthesis is disabled. Long task titles wrap naturally.

## Local font and license

Unmodified upstream variable TTF, native upright, weight axis 200–800 (default 200). Real 200/300/400/500 outlines are available. No external font CDN or runtime network dependency.

Downloaded read-only from Google Fonts:
- https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt
- https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/METADATA.pb

Bundled metadata identifies upstream https://github.com/googlefonts/manrope commit `6f81ebecdf65e4463b798cc07b16a4f8d5216917`. Font SHA256: `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`.

Full SIL Open Font License is retained in fonts/OFL.txt. See fonts/METADATA.pb for attribution. No modified font binaries are distributed.

## Verification

`python3 mobile/typography-preview/verify_font.py` checks actual font coverage, axis and distinct interpolated outlines. `node mobile/typography-preview/test.cjs` checks the browser preview (8020) against a running unchanged production build (8010). Requires existing Playwright, Chromium and fontTools; no new application dependencies.

Evidence: docs/mobile/typography-manrope. All browser contexts contain synthetic data; screenshots use a fixed date for consistency.
