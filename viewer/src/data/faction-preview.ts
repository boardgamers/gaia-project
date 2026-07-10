import Engine, { Faction } from "@gaia-project/engine";

/**
 * A fresh single-faction engine, stopped right after faction selection (no buildings placed yet,
 * no booster picked yet) - the exact round-1, pre-booster-income state the faction board shows
 * physically at the start of a game. A second, throwaway faction fills the required second seat
 * so the engine accepts the game as valid; only player 0 (the requested faction) is ever read.
 */
export function factionPreviewEngine(faction: Faction): Engine {
  const filler = faction === Faction.Terrans ? Faction.Nevlas : Faction.Terrans;
  return new Engine([`init 2 faction-preview-${faction}`, `p1 faction ${faction}`, `p2 faction ${filler}`], {
    lostFleet: true,
  });
}
