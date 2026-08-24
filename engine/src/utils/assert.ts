/**
 * Minimal stand-in for node's `assert` - the only shape the engine ever used (`assert(cond, msg)`).
 * Local so the browser bundle doesn't depend on a node-builtin polyfill (whose CJS/ESM default
 * interop broke the published UMD viewer), and so the package moves to ESM without friction.
 */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

export default function assert(condition: unknown, message: string = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}
