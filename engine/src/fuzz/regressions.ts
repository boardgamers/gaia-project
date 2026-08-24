/**
 * FUZZER_PLAN.md §2 — `regressions/` holds minimized failure fixtures (committed), replayed by a
 * fast spec so every found bug stays fixed forever.
 *
 * Each fixture is a JSON file: `{ name, description, finding, options, moves }`. The generic
 * replay contract (what every fixture must satisfy once its bug is fixed):
 * 1. `new Engine(moves, options)` replays without throwing,
 * 2. host-style play (fromData clone per move — `Engine.slowMotion`, the exact pattern of
 *    `viewer/src/self-contained.ts` and `viewer/src/hosted/host.ts`) reaches the same state as a
 *    plain constructor replay (§J3: deterministic from seed + moves),
 * 3. `Engine.fromData(JSON(engine))` round-trips losslessly.
 */
import fs from "fs";
import path from "path";
import Engine, { EngineOptions } from "../engine";
import { cloneOptions, normalizedEngineState } from "./state";

export interface RegressionFixture {
  name: string;
  description: string;
  /** Findings-table reference (FUZZER_PLAN.md campaign report). */
  finding: string;
  options: EngineOptions;
  moves: string[];
}

export const REGRESSIONS_DIR = path.join(__dirname, "regressions");

export function loadRegressionFixtures(): RegressionFixture[] {
  if (!fs.existsSync(REGRESSIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(REGRESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(REGRESSIONS_DIR, f), "utf8")) as RegressionFixture);
}

export interface RegressionReplayOutcome {
  constructorState: Record<string, any>;
  hostStyleState: Record<string, any>;
  roundTripState: Record<string, any>;
}

export function replayRegression(fixture: RegressionFixture): RegressionReplayOutcome {
  const constructorEngine = new Engine([...fixture.moves], cloneOptions(fixture.options));
  const hostStyleEngine = Engine.slowMotion([...fixture.moves], cloneOptions(fixture.options));
  const roundTripped = Engine.fromData(JSON.parse(JSON.stringify(constructorEngine)));

  return {
    constructorState: normalizedEngineState(constructorEngine),
    hostStyleState: normalizedEngineState(hostStyleEngine),
    roundTripState: normalizedEngineState(roundTripped),
  };
}
