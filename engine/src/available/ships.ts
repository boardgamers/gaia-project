import Engine from "../engine";
import { Building, Command, Expansion, Player, ResearchField, Resource, Ship } from "../enums";
import { GaiaHex } from "../gaia-hex";
import SpaceMap from "../map";
import PlayerObject from "../player";
import { ResearchProgress } from "../player-data";
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

function tradeCost(engine: Engine, player: Player): Reward {
  return new Reward(engine.player(player).data.tradeCost(), Resource.ChargePower);
}

function tradeUnits(engine: Engine, player: Player, building: Building): Reward[] {
  const p = engine.player(player);

  let rewards = [];
  for (let i = 0; i < p.data.tradeBonus; i++) {
    rewards = Reward.merge(rewards.concat(tradeUnit(building)));
  }
  return rewards;
}

function isFurther(guest: ResearchProgress, host: ResearchProgress): number {
  return ResearchField.values(Expansion.All).filter((f) => host[f] > guest[f]).length;
}

function baseTradeReward(building: Building, guest: Player, host: Player, engine: Engine): Reward[] {
  switch (building) {
    //own Mine
    case Building.Mine:
      return Reward.parse("1o");
    case Building.TradingStation:
      return Reward.parse("5c");
    case Building.ResearchLab:
      return Reward.parse("2k");
    case Building.Academy1:
    case Building.Academy2:
      return [
        new Reward(
          Math.max(2, isFurther(engine.player(guest).data.research, engine.player(host).data.research)),
          Resource.Knowledge
        ),
      ];
    case Building.PlanetaryInstitute:
      return Reward.parse("1t,2pw");
    case Building.Colony:
      return Reward.parse("3vp");
  }
  throw new Error("unknown trade bonus: " + building);
}

function tradeUnit(building: Building): Reward[] {
  switch (building) {
    case Building.Mine:
      //foreign mine
      return Reward.parse("1c,1o");
    case Building.TradingStation:
      return Reward.parse("3c,1pw");
    case Building.ResearchLab:
    case Building.Academy1:
    case Building.Academy2:
      return Reward.parse("1k");
    case Building.PlanetaryInstitute:
      return Reward.parse("4pw");
    case Building.Colony:
      return Reward.parse("2vp");
  }
  throw new Error("unknown trade bonus: " + building);
}

function possibleCustomsPost(engine: Engine, h: GaiaHex, player: Player) {
  const p = engine.player(player);
  const b = Building.CustomsPost;
  const units = tradeUnits(engine, player, Building.Mine);
  const canBuildAfterTrade = p.canBuild(engine.map, h, h.data.planet, b, engine.isLastRound, engine.replay, {
    addedCost: Reward.negative(units),
  });
  if (canBuildAfterTrade) {
    canBuildAfterTrade.cost = p.board.cost(b, false);
    const availableBuilding = newAvailableBuilding(b, h, canBuildAfterTrade, false);
    return [
      {
        ...availableBuilding,
        tradeCost: tradeCost(engine, player).toString(),
        rewards: units.toString(),
      },
    ];
  }
  return [];
}

function totalTradeReward(h: GaiaHex, player: Player, engine: Engine): ShipActionLocation[] {
  if (h.hasStructure() && !h.tradeTokens.some((t) => t === player) && !h.customPosts.some((t) => t === player)) {
    const building = h.data.building;
    const host = h.data.player;
    if (host !== player) {
      const canTrade = engine.player(player).data.canPay([tradeCost(engine, player)]);
      if (!canTrade) {
        return [];
      }
      if (building === Building.Mine) {
        return possibleCustomsPost(engine, h, player);
      } else {
        return [
          {
            coordinates: h.toString(),
            tradeCost: tradeCost(engine, player).toString(),
            rewards: Reward.merge(
              baseTradeReward(building, player, host, engine).concat(tradeUnits(engine, player, building))
            ).toString(),
          } as TradingLocation,
        ];
      }
    } else if (building === Building.Mine) {
      return [
        {
          coordinates: h.toString(),
          rewards: baseTradeReward(building, player, host, engine).toString(),
        } as TradingLocation,
      ];
    }
  }
  return [];
}

function possibleTradeShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
  return possibleShipActionsOfType(engine, ship, shipLocation, ShipAction.Trade, true, (h) =>
    totalTradeReward(h, ship.player, engine)
  );
}

function possibleColonyShipActions(
  engine: Engine,
  ship: Ship,
  shipLocation: string,
  requireTemporaryStep: boolean
): AvailableShipAction[] {
  return possibleShipActionsOfType(engine, ship, shipLocation, ShipAction.BuildColony, !requireTemporaryStep, (h) => {
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
  });
}

export function possibleShipActions(
  engine: Engine,
  ship: Ship,
  shipLocation: string,
  requireTemporaryStep: boolean
): AvailableShipAction[] {
  switch (ship.type) {
    case Building.ColonyShip:
      return possibleColonyShipActions(engine, ship, shipLocation, requireTemporaryStep);
    case Building.TradeShip:
      return possibleTradeShipActions(engine, ship, shipLocation);
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
