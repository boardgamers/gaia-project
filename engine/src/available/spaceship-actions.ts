import Engine from "../engine";
import { Command, Player } from "../enums";
import Reward from "../reward";
import { shipsInPlay, spaceshipActionEffects, spaceshipBoards } from "../spaceships";
import { AvailableCommand, AvailableSpaceshipBoardAction } from "./types";

export function possibleSpaceshipActions(engine: Engine, player: Player): AvailableCommand<Command.SpaceshipAction>[] {
  const pl = engine.player(player);
  const actions: AvailableSpaceshipBoardAction[] = [];

  for (const ship of shipsInPlay(engine.expansions, engine.players.length)) {
    if (!pl.data.hasExplored(ship)) {
      continue;
    }

    const wiredEffects = spaceshipActionEffects[ship];
    if (!wiredEffects) {
      continue;
    }

    for (const action of spaceshipBoards[ship].actions) {
      if (!(action.type in wiredEffects)) {
        continue;
      }
      if (engine.spaceshipActions[ship]?.[action.type] !== undefined) {
        continue;
      }
      if (!pl.data.canPay(Reward.parse(action.cost))) {
        continue;
      }

      actions.push({ ship, type: action.type, cost: action.cost });
    }
  }

  if (actions.length === 0) {
    return [];
  }

  return [
    {
      name: Command.SpaceshipAction,
      player,
      data: { actions },
    },
  ];
}
