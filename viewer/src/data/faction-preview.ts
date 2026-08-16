import Engine, { Expansion, Faction, factionPlanet, Player } from "@gaia-project/engine";

/**
 * A fresh single-faction engine, stopped right after faction selection (no buildings placed yet,
 * no booster picked yet) - the exact round-1, pre-booster-income state the faction board shows
 * physically at the start of a game. A second, throwaway faction fills the required second seat
 * so the engine accepts the game as valid; only player 0 (the requested faction) is ever read.
 *
 * The filler must not share a home planet with the requested faction - same-planet pairs (e.g.
 * Terrans/Lantids) are mutually exclusive "opposite factions", and the engine rejects picking one
 * once the other is already taken.
 */
function fillerFaction(faction: Faction): Faction {
  return Faction.values(Expansion.All).find(
    (f) => f !== faction && factionPlanet(f) !== factionPlanet(faction)
  ) as Faction;
}

export function factionPreviewEngine(faction: Faction): Engine {
  const filler = fillerFaction(faction);
  return new Engine([`init 2 faction-preview-${faction}`, `p1 faction ${faction}`, `p2 faction ${filler}`], {
    lostFleet: true,
  });
}

const loadedPlayerCache = new Map<Faction, Player>();

/**
 * A genuine, fully-loaded Player for `faction` - the same starting resources, power bowls and
 * research bumps the physical faction board shows once `Player.loadFaction()` has run. Used to
 * render a real (non-preview) player's board while their own faction is picked but not yet loaded:
 * during the pick/ban/bid setup phases, `pl.faction` is already set but `pl.board` is still null
 * (`loadFaction()` only runs once the auction resolves, in `endSetupFactionPhase`), so `pl.data`
 * itself is still all starting-PlayerData defaults. The result only depends on the faction, never on
 * the live game, so it's cached and safe to share across every board that needs it.
 */
export function loadedFactionPreviewPlayer(faction: Faction): Player {
  let player = loadedPlayerCache.get(faction);
  if (!player) {
    player = factionPreviewEngine(faction).players[0];
    loadedPlayerCache.set(faction, player);
  }
  return player;
}
