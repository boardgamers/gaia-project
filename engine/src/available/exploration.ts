import Engine from "../engine";
import {
  canPayExplorationCost,
  explorationCost,
  explorationCostAdjustments,
  maxExplorationShuttles,
  nextFreeExplorationSlot,
  qicForExplorationDistance,
  spaceshipHex,
} from "../exploration";
import { Command, hasExpansion, Expansion, Player, Resource } from "../enums";
import Reward from "../reward";
import { shipsInPlay, EXPLORATION_CHARGE_TRACK } from "../spaceships";
import { AvailableCommand, AvailableExploreAction } from "./types";

export function possibleExplorations(engine: Engine, player: Player): AvailableCommand<Command.Explore>[] {
  if (!hasExpansion(engine.expansions, Expansion.LostFleet)) {
    return [];
  }

  const pl = engine.player(player);

  if (pl.data.exploredShipsCount() >= maxExplorationShuttles(engine.players.length)) {
    return [];
  }

  const ships: AvailableExploreAction[] = [];

  for (const ship of shipsInPlay(engine.expansions, engine.players.length)) {
    if (pl.data.hasExplored(ship)) {
      continue;
    }

    const hex = spaceshipHex(engine.map, ship);
    if (!hex) {
      continue;
    }

    const slot = nextFreeExplorationSlot(engine.players, ship);
    if (!slot) {
      continue;
    }

    const distanceCost = qicForExplorationDistance(engine.map, hex, pl, engine.replay);
    if (!distanceCost) {
      continue;
    }

    const cost = Reward.merge(explorationCost(pl).concat(new Reward(distanceCost.amount, Resource.Qic)));
    if (!canPayExplorationCost(pl, cost)) {
      continue;
    }

    ships.push({
      ship,
      coordinates: hex.toString(),
      cost: Reward.toString(cost),
      charge: EXPLORATION_CHARGE_TRACK[slot - 1],
      slot,
      adjustments: explorationCostAdjustments(pl),
    });
  }

  if (ships.length === 0) {
    return [];
  }

  return [
    {
      name: Command.Explore,
      player,
      data: { ships },
    },
  ];
}
