# AGENTS.md

Monorepo for the Gaia Project engine + viewer hosted on [boardgamers.space](https://boardgamers.space)
(BGS). pnpm workspace: `engine/` (rules engine, plain TS) and `viewer/` (Vue 2.7 UMD lib consumed by
the BGS iframe wrapper).

## Build & test

```bash
pnpm install                       # pnpm 10+; CI=true to avoid the modules-purge prompt in scripts
cd engine && npm test              # mocha + ts-node (TS via tsconfig "module": "commonjs")
cd engine && npm run build         # tsc -> dist/ (wrapper.js, index.js)
cd viewer && npm test              # vue-cli unit tests (see note on NODE_OPTIONS below)
cd viewer && npm run package       # lib build -> dist/package/viewer.umd.js + .min.js + .css
```

- Viewer unit tests: `NODE_OPTIONS="--localstorage-file=/tmp/gaia-test-ls.json --max-old-space-size=12288"`.
- **Always `rm -rf viewer/node_modules/.cache` before `npm run package`** if you changed TS
  compiler options or anything that feeds cache-loader. Stale cache-loader output has shipped
  broken bundles twice (iterator-spread helper regressing, and a `vue_1.default` interop crash).
  When in doubt, nuke the cache — it is the single biggest "works on my rebuild, broke on theirs"
  trap in this repo.
- The published UMD keeps `vue` and `bootstrap-vue` **external** — the host page provides them
  (`window.Vue`, `window.BootstrapVue`). Never import them in a way that assumes a `.default`
  shape; test any bundler/interop change by loading the built `viewer.umd.js` in a real browser
  page that loads Vue 2 from a CDN, then exercising the viewer (`window.gaiaViewer.launch`).
- Downlevel safety: do NOT use `[...someMap.values()]` / `[...x.entries()]` /
  `[...Array(n).keys()]` iterator spreads in shipped code. Under this toolchain they can
  compile to TS's `__spreadArrays` helper, which reads `.length` on iterators → `Array(NaN)` →
  `RangeError: invalid array length` at runtime (this broke "Rotate sectors" in 5.13.0).
  Use `Array.from(...)` — safe under every downlevel chain.

## Publishing to boardgamers.space

You need an **admin token** (`bgs_admin_…`). Tokens are scoped and can be revoked; ask the BGS
admin for a current one. Do NOT commit tokens anywhere.

The game is registered on the v3 gameinfo service. Base URL: `https://admin.boardgamers.space/api/admin/gameinfo/gaia-project/3`.
All calls take `Authorization: Bearer <token>`.

1. **Engine** — publish the npm tarball (its `version` field becomes the engine version):
   ```bash
   cd engine && npm run build && npm pack        # -> gaia-project-engine-<version>.tgz
   curl -X POST "$BASE/engine" -H "Authorization: Bearer $TOKEN" \
        -F "file=@gaia-project-engine-4.10.3.tgz"
   ```
2. **Viewer files** — upload the freshly built bundle; js+css(+map) that belong together share a
   `bundle` id:
   ```bash
   curl -X POST "$BASE/viewer/file" -H "Authorization: Bearer $TOKEN" \
        -F "file=@dist/package/viewer.umd.min.js" -F "type=js" -F "bundle=<new-bundle-id>"
   curl -X POST "$BASE/viewer/file" -H "Authorization: Bearer $TOKEN" \
        -F "file=@dist/package/viewer.css" -F "type=css" -F "bundle=<new-bundle-id>"
   # same pattern for viewer.umd.min.js.map (type=map), same bundle id
   ```
   Get a fresh `<new-bundle-id>` (uuidgen) — every upload gets a unique one, and the doc's
   `viewer.url` then points at the new bundle's file URL.
3. **Update the doc** — `GET $BASE` to fetch the current gameinfo doc, update the `viewer.url`
   (and `viewer.cssUrl` / engine fields if they changed), then `PUT $BASE` with the whole doc.
   The PUT replaces the stored doc, so send everything back, not just the changed fields.
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
