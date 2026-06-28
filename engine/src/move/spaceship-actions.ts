import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { Command, Player as PlayerEnum, Spaceship, SubPhase } from "../enums";
import Event from "../events";
import Reward from "../reward";
import { SpaceshipActionType, spaceshipActionEffects } from "../spaceships";

export function moveSpaceshipAction(
  engine: Engine,
  command: AvailableCommand<Command.SpaceshipAction>,
  player: PlayerEnum,
  ship: Spaceship,
  type: SpaceshipActionType
) {
  const availableAction = command.data.actions.find((action) => action.ship === ship && action.type === type);

  assert(availableAction !== undefined, `${ship} ${type} action is not available`);

  const pl = engine.player(player);
  engine.spaceshipActions[ship] = { ...engine.spaceshipActions[ship], [type]: player };

  pl.payCosts(Reward.parse(availableAction.cost), ship);

  if (ship === Spaceship.Eclipse && type === "power") {
    engine.processNextMove(SubPhase.UpgradeResearch, null, false);
    return;
  }

  pl.loadEvents(Event.parse(spaceshipActionEffects[ship][type], ship));
}
