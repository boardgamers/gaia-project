/**
 * Test-harness guard, not a test suite of its own.
 *
 * mochapack installs `source-map-support` and sets `Error.stackTraceLimit = Infinity`, so every
 * Error built while the suite runs gets its stack rewritten through source-map-support's
 * `prepareStackTrace`. To map a frame it first calls `retrieveSourceMapURL`, which runs a
 * multiline regex over the *entire* webpack test bundle. Once the bundle grows past a few MB that
 * single `RegExp.exec` exhausts the JS stack, so constructing an Error throws
 * `RangeError: Maximum call stack size exceeded` instead — the thrown error is replaced by the
 * overflow, and any assertion on an error message fails with a message nobody wrote.
 *
 * That made the suite fail as a function of its own bundle size: the two German-rules setup-preview
 * tests passed in isolation and failed once enough other specs were bundled alongside them.
 *
 * Keep source-mapped traces when they work; fall back to the raw V8 frames when the scan blows up.
 */
const original = Error.prepareStackTrace;

Error.prepareStackTrace = (err: Error, frames: NodeJS.CallSite[]) => {
  try {
    return original ? original(err, frames) : undefined;
  } catch {
    return [String(err), ...frames.map((frame) => `    at ${String(frame)}`)].join("\n");
  }
};
