// vue-cli's mocha setup (mocha-webpack) ran specs against jsdom with localstorage enabled and
// chai's expect available globally. Vitest bundles expect itself; chai's deep-equal style
// assertions in the existing specs import chai explicitly - keep that working plus a DOM root.
import { expect } from "vitest";

// jsdom's localStorage is intermittently broken in this environment (getItem/setItem missing on
// `window.localStorage`). Several stores read/write it at module scope, so install a tiny in-memory
// polyfill whenever the real one is absent or non-functional.
(() => {
  const broken =
    typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.getItem !== "function";
  if (!broken) {
    return;
  }
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(String(k)) ? (store.get(String(k)) as string) : null),
    setItem: (k: string, v: string) => void store.set(String(k), String(v)),
    removeItem: (k: string) => void store.delete(String(k)),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  for (const target of [globalThis, ...(typeof window !== "undefined" ? [window] : [])] as any[]) {
    Object.defineProperty(target, "localStorage", { value: ls, configurable: true, writable: true });
  }
})();

// Some specs mount components into document.body (launcher.spec.ts uses unique ids);
// jsdom provides the DOM. Nothing else needed globally - chai is imported per-spec.
export { expect };
