import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { deployExplorationShuttle } from "../exploration";
import { Command, Player as PlayerEnum, Spaceship } from "../enums";
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
  pl.payCosts(Reward.parse(availableShip.cost), Command.Explore);
  deployExplorationShuttle(pl, ship, availableShip.slot, Command.Explore);
}
