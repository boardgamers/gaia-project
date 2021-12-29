import { uniq } from "lodash";
import { stdBuildingValue, upgradedBuildings } from "../buildings";
import { qicForDistance } from "../cost";
import Engine from "../engine";
import { Building, Command, Expansion, Faction, Planet, Player, Resource } from "../enums";
import { GaiaHex } from "../gaia-hex";
import SpaceMap from "../map";
import PlayerObject, { BuildCheck, BuildWarning } from "../player";
import Reward from "../reward";
import { possibleShips } from "./ships";
import {
  AvailableBuildCommandData,
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  ISOLATED_DISTANCE,
} from "./types";

export function newAvailableBuilding(
  building: Building,
  hex: GaiaHex,
  canBuild: BuildCheck,
  upgrade: boolean
): AvailableBuilding {
  return {
    building,
    coordinates: hex.toString(),
    cost: Reward.toString(canBuild.cost),
    warnings: canBuild.warnings,
    steps: canBuild.steps,
    upgrade: upgrade,
  };
}

function addPossibleNewPlanet(
  map: SpaceMap,
  hex: GaiaHex,
  pl: PlayerObject,
  planet: Planet,
  building: Building,
  buildings: AvailableBuilding[],
  lastRound: boolean,
  replay: boolean
) {
  const qicNeeded = qicForDistance(map, hex, pl, replay);
  if (qicNeeded === null) {
    return;
  }

  const check = pl.canBuild(map, hex, planet, building, lastRound, replay, {
    addedCost: [new Reward(qicNeeded.amount, Resource.Qic)],
  });

  if (check) {
    switch (pl.faction) {
      case Faction.Geodens:
        if (building === Building.Mine && !pl.data.hasPlanetaryInstitute() && pl.data.isNewPlanetType(hex)) {
          check.warnings.push(BuildWarning.geodensBuildWithoutPi);
        }
        break;
      case Faction.Lantids:
        if (hex.occupied() && building === Building.Mine) {
          if (
            pl.data.occupied.filter((hex) => hex.data.additionalMine !== undefined).length ===
            pl.maxBuildings(Building.Mine) - 1
          ) {
            check.warnings.push(BuildWarning.lantidsDeadlock);
          }
          if (!pl.data.hasPlanetaryInstitute()) {
            check.warnings.push(BuildWarning.lantidsBuildWithoutPi);
          }
        }

        break;
    }
    const availableBuilding = newAvailableBuilding(building, hex, check, false);
    if (qicNeeded.warning) {
      availableBuilding.warnings.push(qicNeeded.warning);
    }
    buildings.push(availableBuilding);
  }
}

export function possibleBuildings(engine: Engine, player: Player): AvailableCommand<Command.Build>[] {
  const map = engine.map;
  const pl = engine.player(player);
  const buildings: AvailableBuilding[] = [];

  for (const hex of engine.map.toJSON()) {
    // upgrade existing player's building
    const building = hex.buildingOf(player);
    if (building) {
      // excluding Transdim planet until transformed into Gaia planets
      if (hex.data.planet === Planet.Transdim) {
        continue;
      }

      if (hex.isRangeStartingPoint(player) && engine.expansions === Expansion.Frontiers) {
        buildings.push(...possibleShips(pl, engine, map, hex));
      }

      if (player !== hex.data.player) {
        // This is a secondary building, so we can't upgrade it
        continue;
      }

      // Lost planet can't be upgraded
      if (hex.data.planet === Planet.Lost) {
        continue;
      }

      const isolated = (() => {
        // We only care about mines that can transform into trading stations;
        if (building !== Building.Mine) {
          return true;
        }

        // Check each other player to see if there's a building in range
        for (const _pl of engine.players) {
          if (_pl !== pl) {
            for (const loc of _pl.data.occupied) {
              if (loc.hasStructure() && map.distance(loc, hex) < ISOLATED_DISTANCE) {
                return false;
              }
            }
          }
        }

        return true;
      })();

      const upgraded = upgradedBuildings(building, pl.faction);

      for (const upgrade of upgraded) {
        const check = pl.canBuild(map, hex, hex.data.planet, upgrade, engine.isLastRound, engine.replay, {
          isolated,
          existingBuilding: building,
        });
        if (check) {
          buildings.push(newAvailableBuilding(upgrade, hex, check, true));
        }
      }
    } else if (pl.canOccupy(hex)) {
      // planet without building
      // Check if the range is enough to access the planet

      // No need for terra forming if already occupied by another faction
      const planet = hex.occupied() ? pl.planet : hex.data.planet;
      const building = hex.data.planet === Planet.Transdim ? Building.GaiaFormer : Building.Mine;
      addPossibleNewPlanet(map, hex, pl, planet, building, buildings, engine.isLastRound, engine.replay);
    }
  } // end for hex

  if (buildings.length > 0) {
    return [
      {
        name: Command.Build,
        player,
        data: { buildings: uniq(buildings) }, //ship locations may be duplicated
      },
    ];
  }

  return [];
}

export function possibleSpaceStations(engine: Engine, player: Player): AvailableCommand<Command.Build>[] {
  const map = engine.map;
  const pl = engine.player(player);
  const buildings = [];

  for (const hex of map.toJSON()) {
    // We can't put a space station where we already have a satellite
    if (hex.occupied() || hex.hasPlanet() || hex.belongsToFederationOf(player)) {
      continue;
    }

    addPossibleNewPlanet(map, hex, pl, pl.planet, Building.SpaceStation, buildings, engine.isLastRound, engine.replay);
  }

  if (buildings.length > 0) {
    return [{ name: Command.Build, player, data: { buildings } }];
  }

  return [];
}

export function possibleMineBuildings(
  engine: Engine,
  player: Player,
  acceptGaiaFormer: boolean,
  data?: { buildings?: AvailableBuilding[] }
): AvailableCommand<Command.Build>[] {
  if (data && data.buildings) {
    return [{ name: Command.Build, player, data: data as AvailableBuildCommandData }];
  }

  const commands = [];
  const [buildingCommand] = possibleBuildings(engine, player);

  if (buildingCommand) {
    buildingCommand.data.buildings = buildingCommand.data.buildings.filter((bld) => {
      // If it's a gaia-former upgradable to a mine, it doesn't count
      if (bld.upgrade) {
        return false;
      }
      if (bld.building === Building.Mine) {
        return true;
      }
      return acceptGaiaFormer && bld.building === Building.GaiaFormer;
    });

    if (buildingCommand.data.buildings.length > 0) {
      commands.push(buildingCommand);
    }
  }

  return commands;
}

export function possibleLabDowngrades(engine: Engine, player: Player): AvailableCommand<Command.Build>[] {
  const pl = engine.player(player);
  const spots = pl.data.occupied.filter((hex) => hex.buildingOf(player) === Building.ResearchLab);

  if (!spots) {
    return [];
  }

  return [
    {
      name: Command.Build,
      player,
      data: {
        buildings: spots.map((hex) => ({
          building: Building.TradingStation,
          coordinates: hex.toString(),
          cost: "~",
          downgrade: true,
        })),
      },
    },
  ];
}

export function possibleSpaceLostPlanet(engine: Engine, player: Player) {
  const commands = [];
  const p = engine.player(player);
  const data = p.data;
  const spaces: AvailableHex[] = [];

  for (const hex of engine.map.toJSON()) {
    // exclude existing planets, satellites and space stations
    if (hex.data.planet !== Planet.Empty || hex.data.federations || hex.data.building) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, p, engine.replay);

    if (qicNeeded.amount > data.qics) {
      continue;
    }

    spaces.push({
      coordinates: hex.toString(),
      cost: qicNeeded.amount > 0 ? new Reward(qicNeeded.amount, Resource.Qic).toString() : "~",
      warnings: qicNeeded.warning ? [qicNeeded.warning] : null,
    });
  }

  if (spaces.length > 0) {
    commands.push({
      name: Command.PlaceLostPlanet,
      player,
      data: { spaces },
    });
  }

  return commands;
}

export function possiblePISwaps(engine: Engine, player: Player) {
  const commands = [];
  const data = engine.player(player).data;
  const buildings: AvailableBuilding[] = [];

  for (const hex of data.occupied) {
    if (hex.buildingOf(player) === Building.Mine && hex.data.planet !== Planet.Lost) {
      buildings.push({
        building: Building.Mine,
        coordinates: hex.toString(),
        warnings: hex.belongsToFederationOf(player) ? [BuildWarning.ambasSwapIntoFederation] : null,
      });
    }
  }

  if (buildings.length > 0) {
    commands.push({
      name: Command.PISwap,
      player,
      data: { buildings },
    });
  }

  return commands;
}
