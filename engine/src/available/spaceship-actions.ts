import { qicForDistance, terraformingCost } from "../cost";
import Engine from "../engine";
import { Building, Command, Planet, Player, Resource, Spaceship } from "../enums";
import { terraformingStepsRequired } from "../planets";
import { BuildWarning } from "../player";
import Reward from "../reward";
import { shipsInPlay, spaceshipActionEffects, spaceshipBoards } from "../spaceships";
import { AvailableBuilding, AvailableCommand, AvailableHex, AvailableSpaceshipBoardAction } from "./types";

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
      if (
        ship === Spaceship.TFMars &&
        action.type === "power" &&
        possibleInstantGaiaforming(engine, player).length === 0
      ) {
        continue;
      }
      if (
        (ship === Spaceship.Eclipse || ship === Spaceship.TFMars) &&
        action.type === "credit" &&
        possibleSpaceshipBuildMine(engine, player, { ship }).length === 0
      ) {
        continue;
      }
      if (!pl.data.canPay(Reward.parse(action.cost))) {
        continue;
      }

      // §C1: Twilight's Q.I.C. action re-scores a Federation token the player already owns -
      // owner ruling 2026-07-03 (RULES_CLARIFICATIONS.md §C1/§G6 open question resolved): the
      // action is still offered with no owned Federation token (pool or ship-claimed); it just
      // has no effect. Flagged with a warning so a future UI can surface it before commit.
      const noOwnedFederation =
        ship === Spaceship.Twilight &&
        action.type === "qic" &&
        pl.data.tiles.federations.length === 0 &&
        pl.data.spaceshipFederations.length === 0;

      actions.push({
        ship,
        type: action.type,
        cost: action.cost,
        ...(noOwnedFederation ? { warnings: [BuildWarning.noOwnedFederationToRescore] } : {}),
      });
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

export function possibleInstantGaiaforming(
  engine: Engine,
  player: Player
): AvailableCommand<Command.GaiaFormTransdim>[] {
  const pl = engine.player(player);
  const spaces: AvailableHex[] = [];

  if (!pl.data.hasResource(new Reward(1, Resource.GaiaFormer))) {
    return [];
  }

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

/**
 * Eclipse's Credit action (free Mine on an Asteroid, normal range rules, no Gaiaformer needed) and
 * T F Mars's Credit action (terraform 1 step, extra steps cost normal ore, then build a Mine at its
 * normal building cost) both place a Mine via a fixed ship-board fee already paid through
 * Command.SpaceshipAction; this computes only the leftover per-hex cost (range QIC for both ships,
 * plus - T F Mars only - the normal Mine building cost and ore for any terraforming steps beyond the
 * 1 the ship fee covers) and returns it as ordinary Command.Build data so the existing
 * moveBuild/placeBuilding machinery executes the placement (income, federations, leech, etc.) unchanged.
 */
export function possibleSpaceshipBuildMine(
  engine: Engine,
  player: Player,
  data: { ship: Spaceship }
): AvailableCommand<Command.Build>[] {
  const pl = engine.player(player);
  const buildings: AvailableBuilding[] = [];

  if (pl.data.buildings[Building.Mine] >= pl.maxBuildings(Building.Mine)) {
    return [];
  }

  for (const hex of engine.map.toJSON()) {
    if (data.ship === Spaceship.Eclipse) {
      if (hex.data.planet !== Planet.Asteroid || !pl.canOccupy(hex)) {
        continue;
      }
    } else if (hex.data.planet === Planet.Transdim || hex.data.planet === Planet.Asteroid || !pl.canOccupy(hex)) {
      continue;
    }

    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay);
    if (qicNeeded === null) {
      continue;
    }

    const rewards: Reward[] = [];
    let steps = 0;

    if (data.ship === Spaceship.TFMars) {
      const planet = hex.occupied() ? pl.planet : hex.data.planet;
      steps = terraformingStepsRequired(pl.faction, planet, pl.data.lostFleetCost3Planets);
      const oreCost = terraformingCost(pl.data, Math.max(steps - 1, 0), engine.replay);
      if (oreCost === null) {
        continue;
      }
      // The 3c ship fee only covers 1 terraforming step; the mine itself and any further steps are
      // paid normally.
      rewards.push(...pl.board.cost(Building.Mine, false));
      if (oreCost.count > 0) {
        rewards.push(oreCost);
      }
    }

    if (qicNeeded.amount > 0) {
      rewards.push(new Reward(qicNeeded.amount, Resource.Qic));
    }

    const mergedRewards = Reward.merge(rewards);

    if (!pl.data.canPay(mergedRewards)) {
      continue;
    }

    buildings.push({
      building: Building.Mine,
      coordinates: hex.toString(),
      cost: Reward.toString(mergedRewards),
      steps,
      warnings: qicNeeded.warning ? [qicNeeded.warning] : null,
      // §C4: Eclipse's Credit action places the mine on an Asteroid with "the 6 credits [as] the
      // entire cost" — explicitly distinct from §E2's Gaiaformer-consuming route.
      consumesAsteroidGaiaformer: data.ship === Spaceship.Eclipse ? false : undefined,
    });
  }

  if (buildings.length === 0) {
    return [];
  }

  return [{ name: Command.Build, player, data: { buildings } }];
}

/**
 * Twilight's Power action (build a Research Lab) and Rebellion's Power action (build a Trading
 * Station, ignoring the usual isolated-cost check) both upgrade a building the player already owns,
 * paid for entirely by the fixed ship-board fee already taken through Command.SpaceshipAction - no
 * terraforming or range applies since no new hex is being colonized. Returned as ordinary Command.Build
 * data (cost "~") so moveBuild/placeBuilding executes the upgrade unchanged.
 */
export function possibleSpaceshipUpgradeBuilding(
  engine: Engine,
  player: Player,
  data: { from: Building; to: Building }
): AvailableCommand<Command.Build>[] {
  const pl = engine.player(player);
  const buildings: AvailableBuilding[] = [];

  if (pl.data.buildings[data.to] < pl.maxBuildings(data.to)) {
    for (const hex of pl.data.occupied) {
      if (hex.data.player === player && hex.data.building === data.from && hex.data.planet !== Planet.Lost) {
        buildings.push({
          building: data.to,
          coordinates: hex.toString(),
          cost: "~",
          upgrade: true,
        });
      }
    }
  }

  if (buildings.length === 0) {
    return [];
  }

  return [{ name: Command.Build, player, data: { buildings } }];
}
