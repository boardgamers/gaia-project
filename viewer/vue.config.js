/* eslint-disable */
const path = require("path");
const package = require("./package.json");

if (process.argv.includes("lib")) {
  module.exports = {
    lintOnSave: false,
    outputDir: path.join(__dirname, "dist/package"),
    // css: {extract: false}
    chainWebpack: (config) => {
      config.externals({
        "bootstrap-vue": "BootstrapVue",
      });
      // Inline ALL svg assets as data URIs instead of emitting img/*.svg files that resolve
      // against the baked-in publicPath (the versioned jsDelivr URL). This makes the UMD lib a
      // fully self-contained file, so it can be hosted anywhere (S3 upload via the BGS admin
      // API, jsDelivr, ...) without 404ing its images. ~376 KiB of svg, well worth it.
      // "url-loader" resolves through vue-cli's own resolveLoader search path.
      const urlLoader = require.resolve("url-loader", {
        paths: [path.dirname(require.resolve("@vue/cli-service/package.json"))],
      });
      config.module
        .rule("svg")
        .uses.clear()
        .end()
        .use("url-loader")
        .loader(urlLoader)
        .options({ limit: undefined, esModule: false });
      // Package (transpile-only): the published bundle doesn't need full type-checking
      // (that's covered by the test workflow). fork-ts-checker otherwise resolves a hoisted
      // TS and fails on dependency .d.ts files (aria-query, csstype, @types/lodash) that
      // newer pnpm no longer hoists, plus a chart.js typing change — none of which affect
      // the emitted JS. This matches how the powergrid viewer packages its lib.
      config.module
        .rule("ts")
        .use("ts-loader")
        .tap((options) => ({ ...options, configFile: "tsconfig.build.json", transpileOnly: true }));
      config.plugins.delete("fork-ts-checker");
    },
    publicPath: `//cdn.jsdelivr.net/npm/@gaia-project/viewer@${package.version}/dist/package/`,
  };
} else {
  module.exports = {
    lintOnSave: false,
    outputDir: path.join(__dirname, "dist/app"),
    devServer: {
      // For gitpod, it needs to be disabled
      disableHostCheck: true,
    },
    chainWebpack: (config) => {
      // The installed @types/jquery (3.5.x) emits hundreds of type errors under
      // the pinned TypeScript 3.9, which makes the fork-ts-checker plugin hard-fail
      // `vue-cli-service build` even though the app transpiles and runs fine.
      // Transpile-only here so production builds succeed;
      // real type-checking still happens via `tsc` / the engine test suite.
      config.module
        .rule("ts")
        .use("ts-loader")
        .tap((options) => ({ ...options, transpileOnly: true }));
      if (config.plugins.has("fork-ts-checker")) {
        config.plugins.delete("fork-ts-checker");
      }
    },
  };
}
