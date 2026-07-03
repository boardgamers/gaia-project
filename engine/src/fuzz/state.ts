/**
 * State helpers shared by the driver and oracles.
 *
 * Options are ALWAYS cloned before being handed to an Engine: the engine mutates the options
 * object it is given (stamps the generated `map` layout and `factionVariantVersion` into it) —
 * FUZZER_PLAN.md §0, the PROGRESS #48 lesson.
 */
import Engine, { EngineOptions } from "../engine";

export function cloneOptions(options: EngineOptions): EngineOptions {
  return JSON.parse(JSON.stringify(options));
}

/**
 * Engine state as a plain object, normalized for equality comparison:
 * - `availableCommands`/`availableCommand` are derived caches (may or may not be populated
 *   depending on how the engine instance was driven), so they are excluded.
 * - `players[*].data.tiles.booster`: a boosterless player (last-round pass) is `undefined` on a
 *   live engine (`player.ts` `pass()`) but `null` after a JSON round trip (the `PlayerData` class
 *   default, `player-data.ts`). Both mean "no booster" — representational, not behavioral, so the
 *   oracle treats them as equal. (Oracle-calibration finding from the base-game control corpus;
 *   see FUZZER_PLAN.md §5.3 "oracle bug" and the campaign findings table.)
 * - `players[*].federationCache`: a lazy memoization of currently-formable federations
 *   (`player.ts`), (re)computed whenever availability generation happens to need it — two engines
 *   in the same game state legitimately hold different cache snapshots depending on when
 *   available commands were generated. Derived, not game state.
 */
export function normalizedEngineState(engine: Engine): Record<string, any> {
  const state = JSON.parse(JSON.stringify(engine));
  delete state.availableCommands;
  delete state.availableCommand;
  for (const player of state.players ?? []) {
    if (player?.data?.tiles && player.data.tiles.booster == null) {
      delete player.data.tiles.booster;
    }
    if (player && "federationCache" in player) {
      delete player.federationCache;
    }
  }
  return state;
}

export function cloneEngine(engineJson: string): Engine {
  return Engine.fromData(JSON.parse(engineJson));
}
