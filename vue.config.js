/* eslint-disable */
const path = require("path");
const package = require("./package.json");

if (process.argv.includes("lib")) {
  module.exports = {
    lintOnSave: false,
    outputDir: path.join(__dirname, "dist/package"),
    // css: {extract: false}
    chainWebpack: config => {
      config.externals({
        'bootstrap-vue': 'BootstrapVue'
      });
    },
    publicPath: `//cdn.jsdelivr.net/npm/@gaia-project/viewer@${package.version}/dist/package/`
  };
} else {
  module.exports = {
    lintOnSave: false,
    outputDir: path.join(__dirname, "dist/app")
  };
}
