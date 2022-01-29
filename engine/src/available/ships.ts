import Engine from "../engine";
import { Building, Command, Expansion, Player, ResearchField, Resource, Ship } from "../enums";
import { GaiaHex } from "../gaia-hex";
import SpaceMap from "../map";
import PlayerObject from "../player";
import PlayerData, { ResearchProgress } from "../player-data";
import Reward from "../reward";
import { newAvailableBuilding } from "./buildings";
import {
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  AvailableShipAction,
  ShipAction,
  ShipActionLocation,
  TradingLocation,
} from "./types";

const MAX_SHIPS_PER_HEX = 3;
const SHIP_ACTION_RANGE = 1;
export const TRADE_COST = 3;

export type TradeOption = {
  building: Building;
  domestic?: boolean;
  free?: boolean;
  base: Reward[];
  bonus: Reward[];
  researchAdvancementBonus?: boolean;
  build?: Building;
};

export const tradeOptions: TradeOption[] = [
  {
    building: Building.Mine,
    domestic: true,
    free: true,
    base: Reward.parse("1o"),
    bonus: [],
  },
  {
    building: Building.Mine,
    base: [],
    bonus: Reward.parse("1c,1o"),
    build: Building.CustomsPost,
  },
  {
    building: Building.TradingStation,
    base: Reward.parse("5c"),
    bonus: Reward.parse("3c,1pw"),
  },
  {
    building: Building.ResearchLab,
    base: Reward.parse("2k"),
    bonus: Reward.parse("1k"),
  },
  {
    building: Building.Academy1,
    base: Reward.parse("2k"),
    bonus: Reward.parse("1k"),
    researchAdvancementBonus: true,
  },
  {
    building: Building.PlanetaryInstitute,
    base: Reward.parse("1t,2pw"),
    bonus: Reward.parse("4pw"),
  },
  {
    building: Building.Colony,
    base: Reward.parse("3vp"),
    bonus: Reward.parse("2vp"),
  },
];

export function shipsInHex(location: string, data): Ship[] {
  return data.players.flatMap((p) => p.data.ships).filter((s) => s.location === location);
}

export function possibleShips(pl: PlayerObject, engine: Engine, map: SpaceMap, hex: GaiaHex) {
  const buildings: AvailableBuilding[] = [];
  for (const ship of Building.ships()) {
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

function shipTargets(
  source: string,
  hex: string,
  range: number,
  targets: AvailableHex[],
  engine: Engine
): AvailableHex[] {
  if (
    !targets.find((t) => t.coordinates === hex) &&
    (shipsInHex(hex, engine).length < MAX_SHIPS_PER_HEX || source === hex)
  ) {
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

function possibleShipActionsOfType(
  engine: Engine,
  ship: Ship,
  shipLocation: string,
  type: ShipAction,
  allowDecline: boolean,
  locationFactory: (h: GaiaHex) => ShipActionLocation[]
): AvailableShipAction[] {
  const map = engine.map;
  const locations: AvailableHex[] = map
    .withinDistance(map.getS(shipLocation), SHIP_ACTION_RANGE)
    .flatMap((h) => locationFactory(h));
  const actions: AvailableShipAction[] = [];
  if (locations.length > 0) {
    actions.push({
      type,
      locations,
    } as AvailableShipAction);
  }
  if (allowDecline) {
    actions.push({
      type: ShipAction.Nothing,
      locations: [],
    });
  }
  return actions;
}

export function tradeBonus(data: PlayerData, option: TradeOption): Reward[] {
  let rewards = [];
  for (let i = 0; i < data.tradeBonus; i++) {
    rewards = Reward.merge(rewards.concat(option.bonus));
  }
  return rewards;
}

function isFurther(guest: ResearchProgress, host: ResearchProgress): number {
  return ResearchField.values(Expansion.All).filter((f) => host[f] > guest[f]).length;
}

export function baseTradeReward(option: TradeOption, guest: PlayerData, host: PlayerData): Reward[] {
  if (option.researchAdvancementBonus) {
    const base = option.base[0];
    return [new Reward(Math.max(base.count, isFurther(guest.research, host.research)), base.type)];
  }
  return option.base;
}

function possibleBuilding(
  engine: Engine,
  h: GaiaHex,
  player: Player,
  building: Building,
  rewards: Reward[],
  cost: Reward
) {
  const p = engine.player(player);
  const canBuildAfterTrade = p.canBuild(engine.map, h, h.data.planet, building, engine.isLastRound, engine.replay, {
    addedCost: Reward.negative(rewards),
  });
  if (canBuildAfterTrade) {
    canBuildAfterTrade.cost = p.board.cost(building, false);
    const availableBuilding = newAvailableBuilding(building, h, canBuildAfterTrade, false);
    return [
      {
        ...availableBuilding,
        tradeCost: cost.toString(),
        rewards: rewards.toString(),
      },
    ];
  }
  return [];
}

export function tradeRewards(option: TradeOption, guest: PlayerData, host: PlayerData) {
  return Reward.merge(baseTradeReward(option, guest, host).concat(tradeBonus(guest, option)));
}

export function tradeCost(guest: PlayerData, option: TradeOption) {
  return option.free ? new Reward(0, Resource.ChargePower) : guest.tradeCost();
}

function tradeLocations(h: GaiaHex, player: Player, engine: Engine): ShipActionLocation[] {
  const p = engine.player(player);
  if (h.hasStructure() && !h.tradeTokens.some((t) => t === player) && !h.customPosts.some((t) => t === player)) {
    const building = h.data.building;
    const host = engine.player(h.data.player).data;
    const guest = p.data;
    const domestic = h.data.player === player;
    const option = tradeOptions.find((o) => o.building === building && !!o.domestic === domestic);
    if (option) {
      const cost = tradeCost(guest, option);
      if (engine.player(player).data.canPay([cost])) {
        const rewards = tradeRewards(option, guest, host);
        if (option.build) {
          return possibleBuilding(engine, h, player, option.build, rewards, cost);
        } else {
          return [
            {
              coordinates: h.toString(),
              tradeCost: cost.toString(),
              rewards: rewards.toString(),
            } as TradingLocation,
          ];
        }
      }
    }
  }
  return [];
}

function colonyActions(engine: Engine, ship: Ship, h: GaiaHex): AvailableBuilding[] {
  const player = engine.player(ship.player);
  const existingBuilding = h.buildingOf(player.player);
  if (h.hasPlanet() && (!h.occupied() || existingBuilding === Building.GaiaFormer)) {
    const check = player.canBuild(engine.map, h, h.data.planet, Building.Colony, engine.isLastRound, engine.replay, {
      existingBuilding,
    });
    if (check) {
      return [newAvailableBuilding(Building.Colony, h, check, false)];
    }
  }
  return [];
}

export function possibleShipActions(
  engine: Engine,
  ship: Ship,
  shipLocation: string,
  requireTemporaryStep: boolean
): AvailableShipAction[] {
  switch (ship.type) {
    case Building.ColonyShip:
      return possibleShipActionsOfType(engine, ship, shipLocation, ShipAction.BuildColony, !requireTemporaryStep, (h) => colonyActions(engine, ship, h));
    case Building.TradeShip:
      return possibleShipActionsOfType(engine, ship, shipLocation, ShipAction.Trade, true, (h) =>
        tradeLocations(h, ship.player, engine)
      );
  }
  return [];
}

export function possibleShipMovements(
  engine: Engine,
  player: Player,
  requireTemporaryStep: boolean
): AvailableCommand<Command.MoveShip>[] {
  const pl = engine.player(player);

  const ships = pl.data.ships.filter((s) => !s.moved && (!requireTemporaryStep || s.type === Building.ColonyShip));
  if (ships.length === 0) {
    return [];
  }

  const shipRange = engine.player(player).data.shipRange;
  return [
    {
      name: Command.MoveShip,
      player,
      data: ships
        .map((s) => ({
          ship: s.type,
          source: s.location,
          targets: shipTargets(s.location, s.location, shipRange, [], engine)
            .map((t) => ({
              location: t,
              actions: possibleShipActions(engine, s, t.coordinates, requireTemporaryStep),
            }))
            .filter((t) => t.actions.length > 0),
        }))
        .filter((d) => d.targets.length > 0),
    },
  ];
}
