import assert from "../utils/assert";
import { isEqual } from "lodash";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { Building, Command, Condition, Planet, Player as PlayerEnum, Spaceship, SubPhase } from "../enums";
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

  if (type === "qic") {
    pl.receiveTriggerIncome(Condition.SpaceshipQicAction);
  }

  if (ship === Spaceship.Eclipse && type === "power") {
    engine.processNextMove(SubPhase.UpgradeResearch, null, false);
    return;
  }

  if (ship === Spaceship.TFMars && type === "power") {
    engine.processNextMove(SubPhase.InstantGaiaforming, null, false);
    return;
  }

  if ((ship === Spaceship.Eclipse || ship === Spaceship.TFMars) && type === "credit") {
    engine.processNextMove(SubPhase.SpaceshipBuildMine, { ship }, false);
    return;
  }

  if (ship === Spaceship.Rebellion && type === "power") {
    engine.processNextMove(
      SubPhase.SpaceshipUpgradeBuilding,
      { from: Building.Mine, to: Building.TradingStation },
      false
    );
    return;
  }

  if (ship === Spaceship.Twilight && type === "power") {
    engine.processNextMove(
      SubPhase.SpaceshipUpgradeBuilding,
      { from: Building.TradingStation, to: Building.ResearchLab },
      false
    );
    return;
  }

  pl.loadEvents(Event.parse(spaceshipActionEffects[ship][type], ship));
}

export function moveGaiaFormTransdim(
  engine: Engine,
  command: AvailableCommand<Command.GaiaFormTransdim>,
  player: PlayerEnum,
  location: string
) {
  const { spaces } = command.data;
  const parsed = engine.map.parse(location);
  const space = spaces.find((space) => isEqual(engine.map.parse(space.coordinates), parsed));

  assert(space, `Impossible to instant-gaiaform at ${location}`);

  const pl = engine.player(player);
  const hex = engine.map.getS(location);

  pl.build(Building.GaiaFormer, hex, Reward.parse(space.cost), engine.map);
  hex.data.planet = Planet.Gaia;
}
