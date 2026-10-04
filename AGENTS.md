# AGENTS.md

Monorepo for the Gaia Project engine + viewer hosted on [boardgamers.space](https://boardgamers.space)
(BGS). pnpm workspace: `engine/` (rules engine, plain TS) and `viewer/` (Vue 2.7 UMD lib consumed by
the BGS iframe wrapper).

## Build & test

```bash
pnpm install                       # pnpm 10+; CI=true to avoid the modules-purge prompt in scripts
cd engine && npm test              # mocha + ts-node (TS via tsconfig "module": "commonjs")
cd engine && npm run build         # tsc -> dist/ (wrapper.js, index.js)
cd viewer && npm test              # vitest (jsdom); needs --max-old-space-size=12288
cd viewer && npm run package       # vite lib build -> dist/package/viewer.umd.js + .css (+ .map, not uploaded)
```

- Viewer unit tests: `NODE_OPTIONS="--max-old-space-size=12288" npm test` (the suite peaks ~10 GB).
- The viewer builds with **Vite 8 + rolldown** (`vite.config.ts`), tests with **vitest 4**
  (`vitest.config.ts`). Target is `esnext` — no downlevel helpers, no cache-loader, no webpack.
  The old vue-cli/webpack toolchain is gone; `vue-cli-service serve` still exists for the dev app.
- The published IIFE keeps `vue` and `bootstrap-vue` **external** — the host page provides them
  (`window.Vue`, `window.BootstrapVue`). Vite externals resolve to plain global reads (no
  `.default` unwrapping), which is what CDN Vue 2 needs. Test any bundler change by loading the
  built `viewer.umd.js` in a real browser page that loads Vue 2 from a CDN, then exercising the
  viewer (`window.gaiaViewer.launch`).
- `process.env` is baked to `({})` via vite `define` (vue-cli's DefinePlugin used to supply it);
  `VUE_APP_*` env prefs therefore default to undefined/false in the lib build, as before.
- `import type` matters now: rolldown errors on value-imports of type-only exports. When adding
  an import of something that's only a type/interface, write `import type`.

## Publishing to boardgamers.space

You need an **admin token** (`bgs_admin_…`). Tokens are scoped and can be revoked; ask the BGS
admin for a current one. Do NOT commit tokens anywhere.

The game is registered on the v3 gameinfo service. Base URL: `https://admin.boardgamers.space/api/admin/gameinfo/gaia-project/3`.
All calls take `Authorization: Bearer <token>`.

1. **Engine** — publish the npm tarball (its `version` field becomes the engine version). The
   endpoint takes the tarball as the **raw request body** (no multipart):
   ```bash
   cd engine && npm run build && npm pack        # -> gaia-project-engine-<version>.tgz
   curl -X POST "$BASE/engine" -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/octet-stream" \
        --data-binary @gaia-project-engine-<version>.tgz
   ```
2. **Viewer files** — upload the complete `viewer/dist/package` directory (entry JS,
   CSS, language JSON and faction JPG files). Repeat for `old-ui/dist/package` with
   `--alternate`. Use BGS's `scripts/publish-viewer.mjs` or admin **Upload folder**;
   see [viewer publishing](docs/viewer-publishing.md). All files must share the same
   immutable bundle directory. BGS handles gzip automatically. Sourcemaps stay local.
3. **Update the viewer** only after all files are uploaded and verified. Send
   `{ viewer: ... }` to the version PUT endpoint to preserve engine and other metadata.
   Read the current viewer immediately before updating to avoid overwriting another release.
4. Verify on a real BGS game page afterwards (hard-reload; the platform may cache the old
   viewer URL per game).

Before publishing: engine tests + viewer tests + `npm run package` all green, and the built
viewer verified in a real browser (see the loading test above).

## Repo conventions

- `master` is the release branch; changes published to BGS must be pushed there
  as part of publication. Other feature work can land via PRs. Keep CI green: prettier, engine
  eslint (warnings tolerated, errors not), viewer eslint, both test suites.
- lint-staged runs prettier on commit; if its import ordering fights a hand-made change,
  commit with `--no-verify` after confirming `npm run prettier` is clean.
- Version bumps: `engine/package.json` and `viewer/package.json` independently, patch-level
  for fixes. The engine tarball version is what BGS games record per game.

## BGS publication and Git delivery

Whenever changes are published to BGS, commit the corresponding source, tests,
dependency/lockfile changes and version bumps, then push them to this repository's
`main` or `master` release branch in the same task. A BGS upload or a push only to
a feature branch does not complete delivery. This is standing authorization to
commit and push published changes without asking for separate confirmation.

Fetch and integrate the latest release-branch changes, run the relevant repository
checks, and push without force. Update any public mirrors required by this repo's
existing workflow too. Keep credentials, generated artifacts excluded by the repo,
and unrelated unfinished work out of the commit. Verify the remote branch contains
the delivered commit and report any blocker instead of claiming delivery.
