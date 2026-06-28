import { qicForDistance } from "../cost";
import Engine from "../engine";
import { Command, Planet, Player, Resource } from "../enums";
import Reward from "../reward";
import { shipsInPlay, spaceshipActionEffects, spaceshipBoards } from "../spaceships";
import { AvailableCommand, AvailableHex, AvailableSpaceshipBoardAction } from "./types";

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

export function possibleInstantGaiaforming(engine: Engine, player: Player): AvailableCommand<Command.GaiaFormTransdim>[] {
  const pl = engine.player(player);
  const spaces: AvailableHex[] = [];

  for (const hex of engine.map.toJSON()) {
    if (hex.data.planet !== Planet.Transdim || hex.data.building) {
      continue;
    }

    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay);

    if (qicNeeded.amount > pl.data.qics) {
      continue;
    }

    spaces.push({
      coordinates: hex.toString(),
      cost: qicNeeded.amount > 0 ? new Reward(qicNeeded.amount, Resource.Qic).toString() : "~",
      warnings: qicNeeded.warning ? [qicNeeded.warning] : null,
    });
  }

  if (spaces.length === 0) {
    return [];
  }

  return [{ name: Command.GaiaFormTransdim, player, data: { spaces } }];
}
