import { difference, range, uniq } from "lodash";
import {
  boardActions,
  ConversionPool,
  FreeAction,
  freeActionConversions,
  freeActions,
  freeActionsItars,
  freeActionsTerrans,
} from "./actions";
import { stdBuildingValue, upgradedBuildings } from "./buildings";
import { qicForDistance } from "./cost";
import Engine, { AuctionVariant, BoardActions } from "./engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  Booster,
  Building,
  Command,
  Expansion,
  Faction,
  Federation,
  isShip,
  Operator,
  Phase,
  Planet,
  Player,
  ResearchField,
  Resource,
  Ship,
  SubPhase,
  TechTile,
  TechTilePos,
} from "./enums";
import { remainingFactions } from "./factions";
import { GaiaHex } from "./gaia-hex";
import SpaceMap from "./map";
import PlayerObject, { BuildCheck, BuildWarning } from "./player";
import PlayerData, { BrainstoneDest, resourceLimits } from "./player-data";
import * as researchTracks from "./research-tracks";
import Reward from "./reward";
import { AvailableSetupOption, possibleSetupBoardActions } from "./setup";
import { isAdvanced } from "./tiles/techs";

const ISOLATED_DISTANCE = 3;
export const UPGRADE_RESEARCH_COST = "4k";
export const MAX_SHIPS_PER_HEX = 3;
const SHIP_ACTION_RANGE = 1;

export type BrainstoneWarning = "brainstone-charges-wasted";

export type BrainstoneActionData = {
  choices: { area: BrainstoneDest; warning?: BrainstoneWarning }[];
};

export type AvailableFreeAction = {
  cost: string;
  income: string;
  range?: number[];
  hide?: boolean;
};

export type AvailableFreeActionData = {
  acts: AvailableFreeAction[];
};

export type AvailableBoardAction = {
  name: BoardAction;
  cost: string;
  income: string[];
};

export type AvailableBoardActionData = {
  poweracts: AvailableBoardAction[];
};

export class Offer {
  constructor(readonly offer: string, readonly cost: string) {}
}

type BaseCommandData<Command extends string> = { [key in Command]?: any };

type AvailableCommands<
  Command extends string,
  AvailableCommandData extends BaseCommandData<Command>,
  PlayerId = number
> = {
  [command in Command]: _AvailableCommand<Command, AvailableCommandData, command, PlayerId>;
};

type __AvailableCommand<
  Command extends string,
  AvailableCommandData extends BaseCommandData<Command>,
  PlayerId = number
> = AvailableCommands<Command, AvailableCommandData, PlayerId>[Command];

type _CommandHelper<
  Command extends string,
  CommandData extends BaseCommandData<Command>,
  move extends Command
> = move extends keyof CommandData ? CommandData[move] : never;

type _AvailableCommand<
  Command extends string,
  AvailableCommandData extends BaseCommandData<Command>,
  command extends Command,
  PlayerId = number
> = _CommandHelper<Command, AvailableCommandData, command> extends never
  ? { name: command; player: PlayerId }
  : { name: command; player: PlayerId; data: _CommandHelper<Command, AvailableCommandData, command> };

type _MoveNameWithData<Command extends string, AvailableCommandData extends BaseCommandData<Command>> = {
  [command in Command]: _CommandHelper<Command, AvailableCommandData, command> extends never ? never : command;
};

type PossibleBid = { faction: Faction; bid: number[] };

type TechTileWithPos = { tile: TechTile; pos: TechTilePos };
type AdvTechTileWithPos = { tile: AdvTechTile; pos: AdvTechTilePos };
export type ChooseTechTile = TechTileWithPos | AdvTechTileWithPos;

type AvailableBuildCommandData = { buildings: AvailableBuilding[] };

export type AvailableFederation = { hexes: string; warning?: string };

export enum ShipAction {
  BuildColony = "buildColony",
}

export type AvailableShipAction = { type: ShipAction; locations: AvailableBuilding[] };

export type AvailableShipTarget = { location: AvailableHex; actions: AvailableShipAction[] };

export type AvailableMoveShipData = { ship: Building; source: string; targets: AvailableShipTarget[] };

interface CommandData {
  [Command.Action]: AvailableBoardActionData;
  [Command.Bid]: { bids: PossibleBid[] };
  [Command.BrainStone]: BrainstoneActionData;
  [Command.Build]: AvailableBuildCommandData;
  [Command.BurnPower]: number[];
  [Command.ChargePower]: { offers: Offer[] };
  [Command.ChooseCoverTechTile]: { tiles: TechTileWithPos[] };
  [Command.ChooseFaction]: Faction[];
  [Command.ChooseFederationTile]: { tiles: Federation[]; rescore: boolean };
  [Command.ChooseIncome]: Reward[];
  [Command.ChooseRoundBooster]: { boosters: Booster[] };
  [Command.ChooseTechTile]: { tiles: ChooseTechTile[] };
  [Command.DeadEnd]: SubPhase; // for debugging
  [Command.Decline]: { offers: Offer[] };
  [Command.EndTurn]: never;
  [Command.FormFederation]: { tiles: Federation[]; federations: AvailableFederation[] };
  [Command.Init]: never;
  [Command.Pass]: { boosters: Booster[] };
  [Command.PISwap]: AvailableBuildCommandData;
  [Command.PlaceLostPlanet]: { spaces: AvailableHex[] };
  [Command.MoveShip]: AvailableMoveShipData[];
  [Command.RotateSectors]: never;
  [Command.Setup]: AvailableSetupOption;
  [Command.Special]: { specialacts: { income: string; spec: string }[] };
  [Command.Spend]: AvailableFreeActionData;
  [Command.UpgradeResearch]: AvailableResearchData;
}

type AvailableCommand<C extends Command = Command> = __AvailableCommand<C, CommandData>;

export default AvailableCommand;

export type HighlightHex = {
  cost?: string;
  warnings?: BuildWarning[];
  building?: Building;
  hideBuilding?: Building;
  preventClick?: boolean;
};
export type AvailableHex = HighlightHex & { coordinates: string };

export type AvailableBuilding = AvailableHex & {
  building: Building;
  cost: string; // overrides optional cost in HighlightHex
  upgrade?: boolean;
  downgrade?: boolean;
  steps?: number;
};

export type AvailableResearchTrack = { cost: string; field: ResearchField; to: number };
export type AvailableResearchData = { tracks: AvailableResearchTrack[] };

export function conversionToFreeAction(act: AvailableFreeAction): FreeAction | null {
  const entry = Object.entries(freeActionConversions).find(([k, v]) => v.cost === act.cost && v.income === act.income);
  // a new engine might add a conversion that the viewer doesn't know about yet
  return entry !== null ? Number(entry[0]) : null;
}

export function generate(engine: Engine, subPhase: SubPhase = null, data?: any): AvailableCommand[] {
  const player = engine.playerToMove;

  if (engine.phase === Phase.RoundMove && !subPhase) {
    subPhase = SubPhase.BeforeMove;
  }

  switch (subPhase) {
    case SubPhase.ChooseTechTile:
      return possibleTechTiles(engine, player);
    case SubPhase.CoverTechTile:
      return possibleCoverTechTiles(engine, player);
    case SubPhase.UpgradeResearch:
      return possibleResearchAreas(engine, player, "", data);
    case SubPhase.PlaceLostPlanet:
      return possibleSpaceLostPlanet(engine, player);
    case SubPhase.ChooseFederationTile:
      return possibleFederationTiles(engine, player, "pool");
    case SubPhase.RescoreFederationTile:
      return possibleFederationTiles(engine, player, "player");
    case SubPhase.BuildMine:
      return possibleMineBuildings(engine, player, false);
    case SubPhase.BuildMineOrGaiaFormer:
      return possibleMineBuildings(engine, player, true, data);
    case SubPhase.SpaceStation:
      return possibleSpaceStations(engine, player);
    case SubPhase.PISwap:
      return possiblePISwaps(engine, player);
    case SubPhase.DowngradeLab:
      return possibleLabDowngrades(engine, player);
    case SubPhase.BrainStone:
      return [{ name: Command.BrainStone, player, data }];
    // case SubPhase.MoveShip:
    //   return possibleShipMovements(engine, player);
    case SubPhase.BeforeMove: {
      return [
        ...possibleBuildings(engine, player),
        ...possibleShipMovements(engine, player),
        ...possibleFederations(engine, player),
        ...possibleResearchAreas(engine, player, UPGRADE_RESEARCH_COST),
        ...possibleBoardActions(engine.boardActions, engine.player(player), engine.replay),
        ...possibleSpecialActions(engine, player),
        ...possibleFreeActions(engine.player(player)),
        ...possibleRoundBoosters(engine, player),
      ];
    }
    case SubPhase.AfterMove:
      return [...possibleFreeActions(engine.player(player)), { name: Command.EndTurn, player }];
    default:
      break;
  }

  switch (engine.phase) {
    case Phase.SetupInit:
      return [{ name: Command.Init } as AvailableCommand]; //doesn't have player
    case Phase.SetupBoard:
      return possibleSetupBoardActions(engine, player);
    case Phase.SetupFaction:
      return chooseFactionOrBid(engine, player);
    case Phase.SetupAuction:
      return possibleBids(engine, player);
    case Phase.SetupBuilding: {
      const planet = engine.player(player).planet;
      const buildings = [];

      for (const hex of engine.map.toJSON()) {
        if (hex.data.planet === planet && !hex.data.building) {
          buildings.push({
            building: engine.player(player).faction !== Faction.Ivits ? Building.Mine : Building.PlanetaryInstitute,
            coordinates: hex.toString(),
            cost: "~",
          });
        }
      }

      return [{ name: Command.Build, player, data: { buildings } }];
    }
    case Phase.SetupBooster:
      return possibleRoundBoosters(engine, player);
    case Phase.RoundIncome:
      return possibleIncomes(engine, player);
    case Phase.RoundGaia:
      return possibleGaiaFreeActions(engine, player);
    case Phase.RoundLeech:
      return possibleLeech(engine, player);
  }

  return [];
}

function newAvailableBuilding(
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
          check.warnings.push("geodens-build-without-PI");
        }
        break;
      case Faction.Lantids:
        if (hex.occupied() && building === Building.Mine) {
          if (
            pl.data.occupied.filter((hex) => hex.data.additionalMine !== undefined).length ===
            pl.maxBuildings(Building.Mine) - 1
          ) {
            check.warnings.push("lantids-deadlock");
          }
          if (!pl.data.hasPlanetaryInstitute()) {
            check.warnings.push("lantids-build-without-PI");
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

export function shipsInHex(location: string, data): Ship[] {
  return data.players.flatMap((p) => p.data.ships).filter((s) => s.location === location);
}

function possibleShips(pl: PlayerObject, engine: Engine, map: SpaceMap, hex: GaiaHex) {
  const buildings: AvailableBuilding[] = [];
  for (const ship of Object.values(Building).filter((b) => isShip(b))) {
    const check = pl.canBuild(null, null, null, ship, engine.isLastRound, engine.replay);
    if (check) {
      for (const h of map.withinDistance(hex, 1)) {
        if (!h.hasPlanet() && shipsInHex(h.toString(), engine).length < MAX_SHIPS_PER_HEX) {
          buildings.push(newAvailableBuilding(ship, h, check, false));
        }
      }
    }
  }
  return buildings;
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

      if (stdBuildingValue(building) > 0 && engine.expansions === Expansion.Frontiers) {
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

function shipTargets(
  source: string,
  hex: string,
  range: number,
  targets: AvailableHex[],
  engine: Engine
): AvailableHex[] {
  if (!targets.find((t) => t.coordinates === hex) && shipsInHex(hex, engine).length < MAX_SHIPS_PER_HEX) {
    targets.push({ coordinates: hex });
  }
  if (range === 0) {
    return targets;
  }
  const map = engine.map;
  for (const h of map.withinDistance(map.getS(hex), 1)) {
    const c = h.toString();
    if (!h.hasPlanet() && c !== source) {
      shipTargets(source, c, range - 1, targets, engine);
    }
  }
  return targets;
}

function possibleColonyShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
  const map = engine.map;
  const pl = engine.player(ship.player);
  const locations: AvailableHex[] = map.withinDistance(map.getS(shipLocation), SHIP_ACTION_RANGE).flatMap((h) => {
    if (h.hasPlanet() && !h.occupied() && h.data.planet !== Planet.Transdim) {
      const check = pl.canBuild(map, h, h.data.planet, Building.Colony, engine.isLastRound, engine.replay);
      if (check) {
        return [newAvailableBuilding(Building.Colony, h, check, false)];
      }
    }
    return [];
  });
  if (locations.length > 0) {
    return [
      {
        type: ShipAction.BuildColony,
        locations,
      } as AvailableShipAction,
    ];
  }
  return [];
}

function possibleShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
  switch (ship.type) {
    case Building.ColonyShip:
      return possibleColonyShipActions(engine, ship, shipLocation);
  }
  return [];
}

export function possibleShipMovements(engine: Engine, player: Player): AvailableCommand<Command.MoveShip>[] {
  const pl = engine.player(player);

  const ships = pl.data.ships.filter((s) => !s.moved);
  if (ships.length === 0) {
    return [];
  }

  const shipRange = engine.player(player).data.shipRange;
  return [
    {
      name: Command.MoveShip,
      player,
      data: ships.map((s) => ({
        ship: s.type,
        source: s.location,
        targets: shipTargets(s.location, s.location, shipRange, [], engine).map((t) => ({
          location: t,
          actions: possibleShipActions(engine, s, t.coordinates),
        })),
      })),
    },
  ];
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

export function possibleSpecialActions(engine: Engine, player: Player) {
  const commands = [];
  const specialacts = [];
  const pl = engine.player(player);

  for (const event of pl.events[Operator.Activate]) {
    if (!event.activated) {
      if (
        event.rewards[0].type === Resource.DowngradeLab &&
        (pl.data.buildings[Building.ResearchLab] === 0 ||
          pl.data.buildings[Building.TradingStation] >= pl.maxBuildings(Building.TradingStation))
      ) {
        continue;
      }
      if (event.rewards[0].type === Resource.PISwap && pl.data.buildings[Building.Mine] === 0) {
        continue;
      }
      // If the action decreases rewards, the player must have them
      if (!pl.data.canPay(Reward.negative(event.rewards.filter((rw) => rw.count < 0)))) {
        continue;
      }
      specialacts.push({
        income: event.action().rewards, // Reward.toString(event.rewards),
        spec: event.spec,
      });
    }
  }

  if (specialacts.length > 0) {
    commands.push({
      name: Command.Special,
      player,
      data: { specialacts },
    });
  }

  return commands;
}

export function possibleBoardActions(actions: BoardActions, p: PlayerObject, replay: boolean): AvailableCommand[] {
  const commands: AvailableCommand[] = [];

  // not allowed if everything is lost - see https://github.com/boardgamers/gaia-project/issues/76
  const canGain = (reward: Reward) => {
    const type = reward.type;

    if (!(type in resourceLimits)) {
      return true;
    }

    return p.data.getResources(type) < resourceLimits[type];
  };

  let poweracts = BoardAction.values(Expansion.All).filter(
    (pwract) =>
      actions[pwract] === null &&
      p.data.canPay(Reward.parse(boardActions[pwract].cost)) &&
      boardActions[pwract].income.some((income) => Reward.parse(income).some((reward) => replay || canGain(reward)))
  );

  // Prevent using the rescore action if no federation token
  if (p.data.tiles.federations.length === 0) {
    poweracts = poweracts.filter((act) => act !== BoardAction.Qic2);
  }

  if (poweracts.length > 0) {
    const data = {
      poweracts: poweracts.map((act) => ({
        name: act,
        cost: boardActions[act].cost,
        income: boardActions[act].income,
      })),
    } as AvailableBoardActionData;

    commands.push({
      name: Command.Action,
      player: p.player,
      data: data,
    });
  }

  return commands;
}

export function possibleFreeActions(pl: PlayerObject): AvailableCommand<Command.Spend | Command.BurnPower>[] {
  // free action - spend
  const commands: AvailableCommand<Command.Spend | Command.BurnPower>[] = [];

  const pool = new ConversionPool(freeActions, pl);
  pl.emit("freeActionChoice", pool);

  const spendCommand = transformToSpendCommand(pool, pl);
  if (spendCommand) {
    commands.push(spendCommand);
  }

  // free action - burn
  if (pl.data.burnablePower() > 0) {
    commands.push({
      name: Command.BurnPower,
      player: pl.player,
      data: range(1, pl.data.burnablePower() + 1),
    });
  }

  return commands;
}

export function freeActionData(availableFreeActions: FreeAction[], player: PlayerObject): AvailableFreeAction[] {
  const acts: AvailableFreeAction[] = [];
  for (const freeAction of availableFreeActions) {
    const conversion = freeActionConversions[freeAction];
    const maxPay = player.maxPayRange(Reward.parse(conversion.cost));
    if (maxPay > 0) {
      acts.push({
        cost: conversion.cost,
        income: conversion.income,
        range: maxPay > 1 ? range(1, maxPay + 1) : undefined,
      });
    }
  }
  return acts;
}

export function transformToSpendCommand(
  actions: ConversionPool,
  player: PlayerObject
): AvailableCommand<Command.Spend> {
  if (actions.actions.length > 0) {
    return {
      name: Command.Spend,
      player: player.player,
      data: {
        acts: actions.actions,
      },
    };
  }
  return null;
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

export function canResearchField(engine: Engine, player: PlayerObject, field: ResearchField): boolean {
  const destTile = player.data.research[field] + 1;
  if (destTile === researchTracks.lastTile(field) && engine.players.some((p) => p.data.research[field] === destTile)) {
    return false;
  }

  return player.canUpgradeResearch(field);
}

export function possibleResearchAreas(engine: Engine, player: Player, cost?: string, data?: any) {
  const commands = [];
  const tracks: AvailableResearchTrack[] = [];
  const pl = engine.player(player);
  const fields = ResearchField.values(engine.expansions);

  if (pl.data.canPay(Reward.parse(cost))) {
    let avFields: ResearchField[] = fields;

    if (data) {
      if (data.bescods) {
        const minArea = Math.min(...fields.map((field) => pl.data.research[field]));
        avFields = fields.filter((field) => pl.data.research[field] === minArea);
      } else if (data.pos) {
        avFields = [data.pos];
      }
    }

    for (const field of avFields) {
      if (canResearchField(engine, pl, field)) {
        tracks.push({
          field,
          to: pl.data.research[field] + 1,
          cost,
        });
      }
    }
  }

  if (tracks.length > 0) {
    commands.push({
      name: Command.UpgradeResearch,
      player,
      data: { tracks } as AvailableResearchData,
    });
  }

  // decline not for main action
  if (cost !== UPGRADE_RESEARCH_COST) {
    commands.push({
      name: Command.Decline,
      player,
      data: { offers: [new Offer(Command.UpgradeResearch, null)] },
    });
  }
  return commands;
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

export function possibleRoundBoosters(engine: Engine, player: Player) {
  const commands = [];
  const boosters = engine.isLastRound
    ? []
    : Booster.values(Expansion.All).filter((booster) => engine.tiles.boosters[booster]);

  commands.push({
    name: engine.phase === Phase.SetupBooster ? Command.ChooseRoundBooster : Command.Pass,
    player,
    data: { boosters },
  });

  return commands;
}

export function possibleFederations(engine: Engine, player: Player) {
  const commands = [];
  const possibleTiles = Object.keys(engine.tiles.federations).filter((key) => engine.tiles.federations[key] > 0);

  if (possibleTiles.length > 0) {
    if (engine.options.noFedCheck || engine.replay) {
      commands.push({
        name: Command.FormFederation,
        player,
        data: {
          tiles: possibleTiles,
          federations: [],
        },
      });
    } else {
      const p = engine.player(player);
      const possibleFeds = p.availableFederations(engine.map, engine.options.flexibleFederations);

      if (possibleFeds.length > 0 || p.federationCache.custom) {
        commands.push({
          name: Command.FormFederation,
          player,
          data: {
            tiles: possibleTiles,
            federations: possibleFeds.map((fed) => ({
              ...fed,
              hexes: fed.hexes
                .map((hex) => hex.toString())
                .sort()
                .join(","),
              warning:
                p.faction !== Faction.Ivits && fed.newSatellites > p.data.power.area1
                  ? "federation-with-charged-tokens"
                  : null,
            })),
          },
        });
      }
    }
  }

  return commands;
}

export function possibleIncomes(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  const s = pl.incomeSelection();

  if (s.needed) {
    commands.push({
      name: Command.ChooseIncome,
      player,
      data: s.descriptions,
    });
  }
  return commands;
}

export function possibleGaiaFreeActions(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  if (pl.canGaiaTerrans()) {
    commands.push(transformToSpendCommand(new ConversionPool(freeActionsTerrans, pl), pl));
  } else if (pl.canGaiaItars()) {
    if (possibleTechTiles(engine, player).length > 0) {
      commands.push(transformToSpendCommand(new ConversionPool(freeActionsItars, pl), pl));
    }

    commands.push({
      name: Command.Decline,
      player,
      data: { offers: [new Offer(Resource.TechTile, new Reward(4, Resource.GainTokenGaiaArea).toString())] },
    });
  }
  return commands;
}

export function possibleLeech(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  if (pl.data.leechPossible > 0) {
    const extraPower = pl.faction === Faction.Taklons && pl.data.hasPlanetaryInstitute();
    const maxLeech = pl.maxLeech();
    const offers: Offer[] = [];

    if (extraPower) {
      offers.push(...getTaklonsExtraLeechOffers(maxLeech, pl.maxLeech(true)));
    } else {
      offers.push(
        new Offer(
          `${maxLeech}${Resource.ChargePower}`,
          new Reward(Math.max(maxLeech - 1, 0), Resource.VictoryPoint).toString()
        )
      );
    }

    [Command.ChargePower, Command.Decline].map((name) =>
      commands.push({
        name,
        player,
        data: {
          // Kept for compatibility with older viewer
          offer: offers[0].offer,
          // Kept for compatibility with older viewer
          cost: offers[0].cost,
          // new format
          offers,
        },
      })
    );
  }

  return commands;
}

export function getTaklonsExtraLeechOffers(earlyLeechValue: number, lateLeechValue: number): Offer[] {
  const earlyLeech = new Offer(
    `${earlyLeechValue}${Resource.ChargePower},1t`,
    new Reward(Math.max(earlyLeechValue - 1, 0), Resource.VictoryPoint).toString()
  );
  const lateLeech = new Offer(
    `1t,${lateLeechValue}${Resource.ChargePower}`,
    new Reward(Math.max(lateLeechValue - 1, 0), Resource.VictoryPoint).toString()
  );

  return [earlyLeech, lateLeech];
}

export function possibleCoverTechTiles(engine: Engine, player: Player) {
  const commands = [];

  const tiles = engine.player(player).data.tiles.techs.filter((tl) => tl.enabled && !isAdvanced(tl.pos));
  commands.push({
    name: Command.ChooseCoverTechTile,
    player,
    data: { tiles },
  });

  return commands;
}

export function possibleFederationTiles(engine: Engine, player: Player, from: "pool" | "player") {
  const commands: AvailableCommand<Command.ChooseFederationTile>[] = [];

  const possibleTiles: Federation[] = Object.keys(engine.tiles.federations)
    .filter((key) => engine.tiles.federations[key] > 0)
    .map((f) => f as Federation);
  const playerTiles = uniq(engine.player(player).data.tiles.federations.map((fed) => fed.tile));

  commands.push({
    name: Command.ChooseFederationTile,
    player,
    data: {
      tiles: from === "player" ? playerTiles : possibleTiles,
      // Tiles that are rescored just add the rewards, but don't take the token
      rescore: from === "player",
    },
  });

  return commands;
}

export function canTakeAdvancedTechTile(engine: Engine, data: PlayerData, tilePos: AdvTechTilePos): boolean {
  if (engine.tiles.techs[tilePos].count <= 0) {
    return false;
  }
  if (!data.hasGreenFederation()) {
    return false;
  }
  if (data.research[tilePos.slice("adv-".length)] < 4) {
    return false;
  }
  if (!data.tiles.techs.some((tech) => tech.enabled && !isAdvanced(tech.pos))) {
    return false;
  }
  return true;
}

export function possibleTechTiles(engine: Engine, player: Player) {
  const commands = [];
  const tiles = [];
  const data = engine.players[player].data;

  //  tech tiles that player doesn't already have
  for (const tilePos of TechTilePos.values(engine.expansions)) {
    if (!data.tiles.techs.find((tech) => tech.tile === engine.tiles.techs[tilePos].tile)) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos,
      });
    }
  }

  // adv tech tiles where player has lev 4/5, free federation tokens,
  // and available std tech tiles to cover
  for (const tilePos of AdvTechTilePos.values(engine.expansions)) {
    if (canTakeAdvancedTechTile(engine, data, tilePos)) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos,
      });
    }
  }
  if (tiles.length > 0) {
    commands.push({
      name: Command.ChooseTechTile,
      player,
      data: { tiles },
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
        cost: "~",
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

function chooseFactionOrBid(engine: Engine, player: Player): AvailableCommand<Command.Bid | Command.ChooseFaction>[] {
  const chooseFaction: AvailableCommand<Command.Bid | Command.ChooseFaction> = {
    name: Command.ChooseFaction,
    player,
    data: choosableFactions(engine),
  };
  if (engine.options.auction === AuctionVariant.BidWhileChoosing) {
    return [...possibleBids(engine, player), chooseFaction];
  }
  return [chooseFaction];
}

export function choosableFactions(engine: Engine) {
  if (engine.randomFactions) {
    if (engine.options.auction && engine.options.auction !== AuctionVariant.ChooseBid) {
      // In auction the player can pick from the pool of random factions
      return difference(engine.randomFactions, engine.setup);
    } else {
      // Otherwise, they are limited to one specific faction
      return engine.randomFactions.length > engine.setup.length ? [engine.randomFactions[engine.setup.length]] : [];
    }
  } else {
    // Standard
    return remainingFactions(engine.setup);
  }
}

function possibleBids(engine: Engine, player: Player): AvailableCommand<Command.Bid>[] {
  const commands: AvailableCommand<Command.Bid>[] = [];
  const bids: PossibleBid[] = [];

  for (const faction of engine.setup) {
    const bid = engine.players.find((pl) => pl.faction === faction)
      ? engine.players.find((pl) => pl.faction === faction).data.bid
      : -1;
    bids.push({
      faction,
      bid: range(bid + 1, bid + 10),
    });
  }

  if (bids.length > 0) {
    commands.push({
      name: Command.Bid,
      player,
      data: { bids },
    });
  }

  return commands;
}
