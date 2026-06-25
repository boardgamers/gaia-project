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
      config.module
        .rule("ts")
        .use("ts-loader")
        .tap((options) => ({ ...options, configFile: "tsconfig.build.json" }));
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
      // Transpile-only here so production builds (and Vercel deploys) succeed;
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
