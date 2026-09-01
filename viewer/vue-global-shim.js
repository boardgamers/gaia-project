/* eslint-disable */
// Lib-build shim for the webpack external 'vue'.
//
// The published UMD keeps `vue` external - the host page (boardgamers.space's iframe wrapper or
// the demo html) provides `window.Vue`. That global is a plain function (Vue 2's UMD export)
// with NO `.default` property. TypeScript's esModuleInterop emits `vue_1.default` for
// `import Vue from "vue"`, which is undefined for that shape and crashed the bundle at
// module-eval time ("Cannot read properties of undefined (reading 'extend')") in every
// component that calls Vue.extend at module scope.
//
// Resolving `vue$` here normalizes the global into a proper ES-module-shaped object, so
// default imports, namespace imports, and plain CJS requires all work against it.
//
// Kept at the repo root (next to vue.config.js); only wired in the `lib` branch of
// vue.config.js, never in dev/serve builds (those use the real vue package).
(function () {
  var actual;
  if (typeof window !== "undefined" && typeof window.Vue === "function") {
    actual = window.Vue;
  } else if (typeof global !== "undefined" && typeof global.Vue === "function") {
    actual = global.Vue;
  } else if (typeof Vue === "function") {
    actual = Vue; // eslint-disable-line no-undef
  } else if (typeof require === "function") {
    try {
      actual = require("vue");
    } catch (e) {
      actual = undefined;
    }
  }
  if (actual && !actual.__esModule && actual.default === undefined) {
    actual = Object.assign({ default: actual, __esModule: true }, actual);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = actual;
  }
})();
