import Engine from "../engine";
import { Building, Command, isShip, Planet, Player, Resource, Ship } from "../enums";
import { GaiaHex } from "../gaia-hex";
import SpaceMap from "../map";
import PlayerObject from "../player";
import Reward from "../reward";
import { newAvailableBuilding } from "./buildings";
import {
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  AvailableShipAction,
  MAX_SHIPS_PER_HEX,
  ShipAction,
  ShipActionLocation,
  SHIP_ACTION_RANGE,
  TradingLocation,
} from "./types";

export function shipsInHex(location: string, data): Ship[] {
  return data.players.flatMap((p) => p.data.ships).filter((s) => s.location === location);
}

export function possibleShips(pl: PlayerObject, engine: Engine, map: SpaceMap, hex: GaiaHex) {
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

function possibleShipActionsOfType(
  engine: Engine,
  ship: Ship,
  shipLocation: string,
  type: ShipAction,
  locationFactory: (h: GaiaHex) => ShipActionLocation[]
): AvailableShipAction[] {
  const map = engine.map;
  const locations: AvailableHex[] = map
    .withinDistance(map.getS(shipLocation), SHIP_ACTION_RANGE)
    .flatMap((h) => locationFactory(h));
  if (locations.length > 0) {
    return [
      {
        type,
        locations,
      } as AvailableShipAction,
    ];
  }
  return [];
}

function tradeUnits(engine: Engine, player: Player, building: Building): Reward[] {
  const p = engine.player(player);

  let rewards = [];
  for (let i = 0; i < p.data.tradeBonus; i++) {
    rewards = Reward.merge(rewards.concat(tradeUnit(building)));
  }
  return rewards;
}

function baseTradeReward(building: Building): Reward {
  switch (building) {
    case Building.Mine:
      return new Reward(1, Resource.Ore);
    case Building.TradingStation:
      return new Reward(5, Resource.Credit);
    case Building.ResearchLab:
      return new Reward(2, Resource.Knowledge);
    case Building.PlanetaryInstitute:
      return new Reward(5, Resource.ChargePower);
    case Building.Academy1:
    case Building.Academy2:
      return new Reward(2, Resource.Knowledge);
    case Building.Colony:
      return new Reward(3, Resource.VictoryPoint);
  }
  throw new Error("unknown trade bonus: " + building);
}

function tradeUnit(building: Building): Reward[] {
  switch (building) {
    case Building.Mine:
      return Reward.parse("1c,1o");
    case Building.TradingStation:
      return Reward.parse("2c,1pw");
    case Building.ResearchLab:
    case Building.Academy1:
    case Building.Academy2:
      return Reward.parse("1k");
    case Building.PlanetaryInstitute:
      return Reward.parse("3pw");
    case Building.Colony:
      return Reward.parse("2vp");
  }
  throw new Error("unknown trade bonus: " + building);
}

function possibleTradeShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
  return possibleShipActionsOfType(engine, ship, shipLocation, ShipAction.Trade, (h) => {
    const player = ship.player;
    if (h.hasStructure() && !h.tradeTokens.some((t) => t === player) && !h.customPosts.some((t) => t === player)) {
      const building = h.data.building;
      const host = h.data.player;
      if (host !== player && building === Building.Mine) {
        const check = engine
          .player(player)
          .canBuild(engine.map, h, h.data.planet, Building.CustomsPost, engine.isLastRound, engine.replay);
        if (check) {
          const b = newAvailableBuilding(Building.CustomsPost, h, check, false);
          b.cost = Reward.merge(
            Reward.parse(b.cost).concat(Reward.negative(tradeUnits(engine, player, building)))
          ).toString();
          return [b];
        }
      } else if (host !== player || building === Building.Mine) {
        return [
          {
            coordinates: h.toString(),
            rewards: (host !== player
              ? Reward.merge([baseTradeReward(building)].concat(tradeUnits(engine, player, building)))
              : tradeUnits(engine, player, building)
            ).toString(),
          } as TradingLocation,
        ];
      }
    }
    return [];
  });
}

function possibleColonyShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
  return possibleShipActionsOfType(engine, ship, shipLocation, ShipAction.BuildColony, (h) => {
    if (h.hasPlanet() && !h.occupied() && h.data.planet !== Planet.Transdim) {
      const check = engine
        .player(ship.player)
        .canBuild(engine.map, h, h.data.planet, Building.Colony, engine.isLastRound, engine.replay);
      if (check) {
        return [newAvailableBuilding(Building.Colony, h, check, false)];
      }
    }
    return [];
  });
}

export function possibleShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
  switch (ship.type) {
    case Building.ColonyShip:
      return possibleColonyShipActions(engine, ship, shipLocation);
    case Building.TradeShip:
      return possibleTradeShipActions(engine, ship, shipLocation);
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
