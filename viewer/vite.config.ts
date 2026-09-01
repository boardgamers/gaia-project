import vue from "@vitejs/plugin-vue2";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Lib build (replaces `vue-cli-service build --target lib src/wrapper.ts`).
 *
 * Contract to keep byte-compatible with the boardgamers.space host page:
 *  - ONE self-contained IIFE file exposing `window.gaiaViewer = { launch, launchSelfContained }`
 *    (the platform's iframe wrapper reads `viewer.topLevelVariable` = "gaiaViewer").
 *  - `vue` and `bootstrap-vue` stay EXTERNAL - the host page provides them
 *    (`window.Vue`, `window.BootstrapVue`). Vite's iife externals resolve them as
 *    plain global reads with no `.default` unwrapping, which is exactly what the
 *    CDN-provided Vue 2 needs (the old TS `vue_1.default` interop crash cannot happen here).
 *  - All svg assets inline as data URIs (Vite's default below assetsInlineLimit), so the
 *    UMD is one portable file with no img/ directory to host.
 *  - CSS extracts to viewer.css alongside the bundle; the sourcemap's relative
 *    sourceMappingURL keeps working because js+map share the BGS bundle directory.
 */
// `vite` / `vite serve` runs the dev app (index.html + src/main.ts entry, public/ assets);
// `vite build` produces the published IIFE lib (src/wrapper.ts). Everything lib-specific
// (appType/publicDir/lib entry/externals) is scoped to the build; the dev app gets the
// standard SPA treatment.
const building = process.argv.includes("build");

export default defineConfig({
  // Lib build only: no app shell, no public assets, NODE_ENV baked to production (the
  // published bundle must not keep dev branches). The dev app flips all of these.
  ...(building ? { appType: "custom", publicDir: false } : {}),
  // Dev only: never let the dep-optimizer pre-bundle the workspace engine - the aliases below
  // point the bare specifier at engine SOURCE, and esbuild pre-bundling would race the first
  // page load with a stale CJS dist snapshot ("does not provide an export named ...").
  ...(building ? {} : { optimizeDeps: { exclude: ["@gaia-project/engine"] } }),
  define: {
    // vue-cli's DefinePlugin supplied `process.env` (empty object) plus VUE_APP_* vars that
    // default to undefined. webpack also auto-shimmed bare `process` in the browser; rolldown
    // doesn't, so replace the whole expression. Empty object reproduces the old defaults:
    // !!undefined === false, `?? x` falls through, for-in over {} iterates nothing.
    "process.env.NODE_ENV": JSON.stringify(building ? "production" : "development"),
    "process.env": "({})",
  },
  plugins: [vue()],
  build: {
    outDir: "dist/package",
    emptyOutDir: true,
    // esnext: no downlevelling - this is what killed __spreadArrays (iterator spread -> RangeError)
    target: "esnext",
    // self-contained: css inlined into the single js file? No - BGS loads viewer.css separately
    // from the same bundle dir; keep cssCodeSplit false so it lands in one viewer.css.
    cssCodeSplit: false,
    minify: true,
    ...(building
      ? {
          lib: {
            entry: join(root, "src/wrapper.ts"),
            name: "gaiaViewerLib",
            formats: ["iife"],
            fileName: () => "viewer.umd.js",
          },
        }
      : {}),
    rollupOptions: {
      // IIFE externals resolve to plain global identifier reads at runtime (build only -
      // the dev app bundles its own copies).
      external: building ? ["vue", "bootstrap-vue"] : [],
      output: {
        globals: { vue: "Vue", "bootstrap-vue": "BootstrapVue" },
        sourcemap: true,
        // wrapper.ts exports default + launchSelfContained; IIFE exposes them as
        // window.<name>.default / .launchSelfContained - wrapper.ts already assigns
        // window.gaiaViewer itself, so the IIFE global is just a fallback for CJS hosts.
        exports: "named",
      },
    },
  },
  // Everything under src/assets is small svg icons -> always inline (Vite inlines assets
  // below assetsInlineLimit by default; raise it to "always inline" for .svg only via
  // a plugin would be overkill - set the limit high enough for all our svgs instead).
  assetsInclude: ["**/*.svg"],
  css: {
    preprocessorOptions: {
      scss: {
        // Let `~pkg/file` imports (webpack-era syntax in frontend.scss) resolve: Vite doesn't
        // do the ~ dance for scss imports, so map the importer through node_modules load paths.
        importers: [
          {
            findFileUrl(url) {
              if (!url.startsWith("~")) return null;
              const pkgPath = url.slice(1);
              // "~pkg" (bare) means the package's style entry: bootstrap-vue exposes
              // src/index.scss; scss files in the wild expect webpack's resolution where
              // "~bootstrap-vue" hits the package root and sass picks index.
              const candidates = pkgPath.includes("/")
                ? [join(root, "node_modules", pkgPath)]
                : [
                    join(root, "node_modules", pkgPath, "src/index.scss"),
                    join(root, "node_modules", pkgPath, "index.scss"),
                  ];
              for (const c of candidates) {
                if (existsSync(c)) return new URL("file:" + c);
              }
              return null;
            },
          },
        ],
        quietDeps: true,
        silenceDeprecations: ["legacy-js-api", "import", "global-builtin"],
      },
    },
  },
  resolve: {
    // Array form so the dev-only engine aliases can be conditionally spread. The workspace-linked
    // engine package is CJS (main = dist/index.js) which the dev server can't interop for named
    // ESM imports (`Planet` fails with "does not provide an export"), and its /wrapper + /src/*
    // subpaths have no package.json "exports" map for vite to follow - so dev maps everything
    // onto the engine SOURCE (vite transpiles TS natively). The lib build (building=true) keeps
    // the real package resolution: same emitted shapes, and `~` scss imports (~bootstrap/...,
    // ~bootstrap-vue) must keep resolving into node_modules either way.
    alias: [
      { find: "~", replacement: join(root, "node_modules") },
      ...(building
        ? []
        : [
            { find: /^@gaia-project\/engine\/wrapper$/, replacement: join(root, "..", "engine", "wrapper.ts") },
            { find: /^@gaia-project\/engine\/src\//, replacement: join(root, "..", "engine", "src/") },
            { find: /^@gaia-project\/engine$/, replacement: join(root, "..", "engine", "index.ts") },
          ]),
    ],
  },
});

// Post-build step (replaces scripts/fix-package-imports.ts): the CSS references img/ paths
// relative to itself; when assets end up in subdirs, rewrite url(img/) -> url(../img/).
