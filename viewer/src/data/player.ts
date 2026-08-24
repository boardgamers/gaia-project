import Engine, { Player } from "@gaia-project/engine";

export function orderedPlayers(engine: Engine): Player[] {
  if (!engine.round || !engine.turnOrder) {
    return engine.players.filter((player): player is Player => !!player);
  }
  return engine.turnOrder
    .concat(engine.passedPlayers)
    .map((player) => engine.players[player])
    .filter((player): player is Player => !!player);
}
