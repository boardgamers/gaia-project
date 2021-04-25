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
  };
}
