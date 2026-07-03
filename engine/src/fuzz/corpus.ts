/**
 * FUZZER_PLAN.md §2/§4 — seed corpus definition.
 *
 * - SMOKE corpus: a handful of fixed seeds, played end-to-end as part of `npm test` (seconds).
 * - CAMPAIGN corpus: hundreds of seeds for the separate CLI runner (`npm run fuzz`), NEVER part
 *   of `npm test`. All seeds derive from a fixed base string so campaigns are reproducible and
 *   diffable (§4).
 *
 * Base-game seeds are the CONTROL corpus (§3 tier 2): the mature base engine is trusted, so any
 * noise there means the oracle is mis-calibrated, not the engine.
 */
import { FuzzGameSpec } from "./driver";

export const CORPUS_BASE_SEED = "lost-fleet-fuzz-v1";

function spec(kind: "base" | "lf", players: number, index: number): FuzzGameSpec {
  const gameSeed = `${CORPUS_BASE_SEED}-${kind}-${players}p-${index}`;
  return { gameSeed, playSeed: `${gameSeed}-play`, players, lostFleet: kind === "lf" };
}

/** Fixed smoke seeds for `npm test` — small on purpose (runtime budget: seconds). */
export function smokeCorpus(): FuzzGameSpec[] {
  return [
    spec("base", 2, 0),
    spec("base", 2, 1),
    spec("base", 3, 0),
    spec("base", 4, 0),
  ];
}

/** Lost Fleet smoke seeds — switched on once the base control corpus is quiet (plan §6 phase 2). */
export function lostFleetSmokeCorpus(): FuzzGameSpec[] {
  return [spec("lf", 2, 0), spec("lf", 2, 1), spec("lf", 3, 0), spec("lf", 4, 0)];
}

/** Campaign corpus: `lfGames` Lost Fleet seeds + `baseGames` base-game control seeds, cycling 2/3/4 players. */
export function campaignCorpus(lfGames: number, baseGames: number, seedBase = CORPUS_BASE_SEED): FuzzGameSpec[] {
  const specs: FuzzGameSpec[] = [];
  const playerCounts = [2, 3, 4];
  for (let i = 0; i < lfGames; i++) {
    const players = playerCounts[i % playerCounts.length];
    const gameSeed = `${seedBase}-lf-${players}p-${Math.floor(i / playerCounts.length)}`;
    specs.push({ gameSeed, playSeed: `${gameSeed}-play`, players, lostFleet: true });
  }
  for (let i = 0; i < baseGames; i++) {
    const players = playerCounts[i % playerCounts.length];
    const gameSeed = `${seedBase}-base-${players}p-${Math.floor(i / playerCounts.length)}`;
    specs.push({ gameSeed, playSeed: `${gameSeed}-play`, players, lostFleet: false });
  }
  return specs;
}
