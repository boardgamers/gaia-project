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
2. **Viewer files** — upload the freshly built bundle. `npm run package` emits
   `dist/package/viewer.umd.js` (already minified) + `viewer.css`; the platform's doc expects the
   js under the name `viewer.umd.min.js`, so copy/rename it first. These endpoints take the file
   as the **raw request body** (no multipart!), with parameters in the query string; js+css share
   a `bundle` id so they belong together:
   ```bash
   cp dist/package/viewer.umd.js dist/package/viewer.umd.min.js
   # (optional) strip the trailing sourceMappingURL - the map isn't uploaded anyway:
   # sed -i 's|//# sourceMappingURL=viewer.umd.js.map||' dist/package/viewer.umd.min.js
   curl -X POST "$BASE/viewer/file?filename=viewer.umd.min.js&bundle=<new-bundle-id>" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/javascript" \
        --data-binary @dist/package/viewer.umd.min.js
   curl -X POST "$BASE/viewer/file?filename=viewer.css&bundle=<new-bundle-id>" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/css" \
        --data-binary @dist/package/viewer.css
   ```
   No sourcemap upload needed — owner decision (2026-09): the platform doesn't deploy maps
   in general. The bundle's trailing sourceMappingURL is harmless (the map 404s quietly).
   Get a fresh `<new-bundle-id>` (uuidgen or a timestamped tag) — every upload gets a unique
   one, and the doc's `viewer.url` then points at the new bundle's file URL.
3. **Update the doc** — `GET $BASE` to fetch the current gameinfo doc, update the
   `viewer.url` and `viewer.dependencies.stylesheets` (and engine fields if they changed), then
   `PUT $BASE` with the whole doc. The PUT replaces the stored doc, so send everything back, not
   just the changed fields. **Always GET right before PUT** — the engine-upload step mutates the
   doc (sets `engine.package`), and a PUT based on an earlier GET silently reverts it.
4. Verify on a real BGS game page afterwards (hard-reload; the platform may cache the old
   viewer URL per game).

Before publishing: engine tests + viewer tests + `npm run package` all green, and the built
viewer verified in a real browser (see the loading test above).

## Repo conventions

- `master` is the release branch; feature work lands via PRs. Keep CI green: prettier, engine
  eslint (warnings tolerated, errors not), viewer eslint, both test suites.
- lint-staged runs prettier on commit; if its import ordering fights a hand-made change,
  commit with `--no-verify` after confirming `npm run prettier` is clean.
- Version bumps: `engine/package.json` and `viewer/package.json` independently, patch-level
  for fixes. The engine tarball version is what BGS games record per game.
