// vue-cli's mocha setup (mocha-webpack) ran specs against jsdom with localstorage enabled and
// chai's expect available globally. Vitest bundles expect itself; chai's deep-equal style
// assertions in the existing specs import chai explicitly - keep that working plus a DOM root.
import { expect } from "vitest";

// Some specs mount components into document.body (launcher.spec.ts uses unique ids);
// jsdom provides the DOM. Nothing else needed globally - chai is imported per-spec.
export { expect };
