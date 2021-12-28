import Engine from "../engine";
import { Building, Command, isShip, Planet, Player, Ship } from "../enums";
import { GaiaHex } from "../gaia-hex";
import SpaceMap from "../map";
import PlayerObject from "../player";
import { newAvailableBuilding } from "./buildings";
import {
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  AvailableShipAction,
  MAX_SHIPS_PER_HEX,
  ShipAction,
  SHIP_ACTION_RANGE,
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

export function possibleShipActions(engine: Engine, ship: Ship, shipLocation: string): AvailableShipAction[] {
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
