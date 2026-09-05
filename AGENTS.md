# prep/v2-viewer branch

Pre-Lost-Fleet viewer for the **v2** gameinfo on boardgamers.space.

- Based on tag `v5.12.0`: **viewer 5.12.0 + engine 4.9.0** — the exact pairing the v2 doc records
  (`GET https://admin.boardgamers.space/api/admin/gameinfo/gaia-project/2`).
- This branch predates the Vite migration: builds with the **vue-cli/webpack** toolchain
  (`npm run package`), which emits `dist/package/viewer.umd.min.js` + `viewer.css` directly
  (no rename needed, unlike the v3 Vite build).

## ⚠️ Do NOT republish a locally-built bundle (2026-09 attempt failed)

A fresh `npm run package` here produces a bundle that **crashes on load** in the browser:

- `TypeError: can't access property "color"` / `ReferenceError: Cannot access 'Oe' before
  initialization` (a TDZ error from a circular import, made fatal by **toolchain drift** — the
  local install resolves webpack 4.47 / ts-loader / TS 3.9 against the repo's loose `^` ranges,
  not the exact pins the original 5.12.0 was built with).
- Symptom: `window.gaiaViewer` stays `undefined`, so the BGS iframe's `window.gaiaViewer.launch`
  throws "can't access property launch".

**v2 is restored to the known-good jsdelivr bundle** (`@gaia-project/viewer@5.12.0` —
that exact npm artifact works). If you need to ship a *changed* v2 viewer, don't just rebuild from
this branch as-is: first reproduce the original toolchain exactly (check the v5.12.0-era lockfile /
pin webpack, ts-loader, and TS to the versions that produced the published 5.12.0 artifact), or
publish a new npm patch (`5.12.1`) built in that reproduced environment so jsdelivr serves it.

## Publish paths

- **jsdelivr (current)**: bump `viewer/package.json` to a new patch and `npm publish`; the v2 doc's
  `viewer.url` (`//cdn.jsdelivr.net/npm/@gaia-project/viewer@<ver>/dist/package/viewer.umd.min.js`)
  picks it up by version.
- **S3 (like v3)**: upload via `$BASE/viewer/file?filename=…&bundle=<id>` against the **v2** base
  URL (`…/gaia-project/2`) and update the v2 doc's `viewer.url` + `dependencies.stylesheets` to the
  returned S3 URLs.
