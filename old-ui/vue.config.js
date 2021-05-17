/* eslint-disable */
const path = require("path");

if (process.argv.includes("lib")) {
  module.exports = {
    lintOnSave: false,
    outputDir: path.join(__dirname, "dist/package"),
    // css: {extract: false}
    chainWebpack: (config) => {
      config.externals({
        "bootstrap-vue": "BootstrapVue",
      });
    },
  };
} else {
  module.exports = {
    lintOnSave: false,
    outputDir: path.join(__dirname, "dist/app"),
  };
}
