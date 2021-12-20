import Engine, { Player } from "@gaia-project/engine";

export function orderedPlayers(engine: Engine): Player[] {
  if (!engine.round || !engine.turnOrder) {
    return engine.players;
  }
  return engine.turnOrder.concat(engine.passedPlayers).map((player) => engine.players[player]);
}
