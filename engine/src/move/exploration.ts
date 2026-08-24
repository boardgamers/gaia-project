import assert from "../utils/assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { Command, Player as PlayerEnum, Spaceship } from "../enums";
import { canPayExplorationCost, deployExplorationShuttle } from "../exploration";
import Reward from "../reward";

export function moveExplore(
  engine: Engine,
  command: AvailableCommand<Command.Explore>,
  player: PlayerEnum,
  ship: Spaceship
) {
  const availableShip = command.data.ships.find((entry) => entry.ship === ship);

  assert(availableShip !== undefined, `${ship} is not in the available exploration targets`);

  const pl = engine.player(player);
  const cost = Reward.parse(availableShip.cost);

  assert(canPayExplorationCost(pl, cost), `${player} cannot pay the exploration cost for ${ship}`);

  pl.payCosts(cost, Command.Explore);
  deployExplorationShuttle(pl, ship, availableShip.slot, Command.Explore);
}
