# prep/v2-viewer branch

Pre-Lost-Fleet viewer build for the **v2** gameinfo on boardgamers.space.

- Based on tag `v5.12.0`: **viewer 5.12.0 + engine 4.9.0** — the exact pairing the v2 doc records
  (`GET https://admin.boardgamers.space/api/admin/gameinfo/gaia-project/2`).
- This branch predates the Vite migration: build with the **vue-cli/webpack** toolchain
  (`npm run package`), which emits `dist/package/viewer.umd.min.js` + `viewer.css` directly
  (no rename needed, unlike the v3 Vite build).
- The v2 doc points the viewer at **jsdelivr** (`@gaia-project/viewer@5.12.0`), not the BGS asset
  S3. To ship a rebuilt v2 bundle, either publish a new npm patch (`5.12.1`) so jsdelivr picks it
  up, or upload via `$BASE/viewer/file?...&bundle=<id>` against the **v2** base URL and update the
  v2 doc's `viewer.url`/stylesheets to the S3 URLs (same flow as v3, but base URL ends in `/2`).
- Not published yet — owner decides when/whether to cut the v2 update over.
