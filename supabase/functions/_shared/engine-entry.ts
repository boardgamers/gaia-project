// Bundle entry point for the edge-function engine (PREMOVE_PLAN.md §1).
//
// Deno cannot resolve the engine's bare npm specifiers (lodash, hexagrid,
// seedrandom, semver-compare, shuffle-seed, eventemitter3) without a hand-
// maintained import map, so this file is never imported by Deno directly.
// Instead a predeploy esbuild step (see package.json's "build:edge-engine")
// bundles it into a single ESM file, engine.bundle.js, which IS deployed and
// imported by the edge functions. Only the "assert" bare import (Node's
// built-in, used throughout engine/src) is left external, aliased to
// Deno's native "node:assert" — see esbuild.edge-engine.mjs.
// Note: Phase lives in enums.ts, not engine.ts (engine.ts imports it but never
// re-exports it) — the plan's snippet had this wrong; engine/index.ts's own
// public export list (line 55) confirms enums.ts is the real source.
export { default as Engine } from "../../../engine/src/engine";
export { Phase } from "../../../engine/src/enums";
export {
  autoDecideChargePower,
  parseAutoChargeMaxPassedRoundLeech,
  parseAutoChargePreference,
} from "../../../viewer/src/logic/auto-decide";
