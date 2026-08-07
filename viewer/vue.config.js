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
  };
}
