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
export default defineConfig({
  // no app shell: the lib entry only; dev serves from src/demo for local testing
  appType: "custom",
  publicDir: false,
  define: {
    // vue-cli's DefinePlugin supplied `process.env` (empty object) plus VUE_APP_* vars that
    // default to undefined. webpack also auto-shimmed bare `process` in the browser; rolldown
    // doesn't, so replace the whole expression. Empty object reproduces the old defaults:
    // !!undefined === false, `?? x` falls through, for-in over {} iterates nothing.
    "process.env.NODE_ENV": JSON.stringify("production"),
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
    lib: {
      entry: join(root, "src/wrapper.ts"),
      name: "gaiaViewerLib",
      formats: ["iife"],
      fileName: () => "viewer.umd.js",
    },
    rollupOptions: {
      // IIFE externals resolve to plain global identifier reads at runtime.
      external: ["vue", "bootstrap-vue"],
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
    alias: {
      // keep `~` scss imports (~bootstrap/..., ~bootstrap-vue) working
      "~": join(root, "node_modules"),
    },
  },
});

// Post-build step (replaces scripts/fix-package-imports.ts): the CSS references img/ paths
// relative to itself; when assets end up in subdirs, rewrite url(img/) -> url(../img/).
