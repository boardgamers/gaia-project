import assert from "assert";
import { isEqual } from "lodash";
import { AvailableBuilding, AvailableCommand } from "../available/types";
import Engine from "../engine";
import { Building, Command, isShip, Phase, Planet, Player as PlayerEnum } from "../enums";
import Player from "../player";
import Reward from "../reward";

export function moveBuild(
  engine: Engine,
  command: AvailableCommand<Command.Build>,
  player: PlayerEnum,
  building: Building,
  location: string
) {
  const { buildings } = command.data;
  const parsed = engine.map.parse(location);
  const pl = engine.player(player);

  for (const elem of buildings) {
    if (elem.building === building && isEqual(engine.map.parse(elem.coordinates), parsed)) {
      placeBuilding(engine, pl, elem);
      return;
    }
  }

  assert(
    false,
    `Impossible to execute build command at ${location}, available: ${buildings.map((b) => b.coordinates)}`
  );
}

export function placeBuilding(engine: Engine, pl: Player, building: AvailableBuilding) {
  const hex = engine.map.getS(building.coordinates);
  pl.build(building.building, hex, Reward.parse(building.cost), engine.map, building.steps);

  // will trigger a LeechPhase
  if ((engine.phase === Phase.RoundMove || engine.phase === Phase.RoundShip) && !isShip(building.building)) {
    engine.leechSources.unshift({ player: pl.player, coordinates: building.coordinates });
  }
}

export function moveLostPlanet(
  engine: Engine,
  command: AvailableCommand<Command.PlaceLostPlanet>,
  player: PlayerEnum,
  location: string
) {
  const { spaces } = command.data;
  const parsed = engine.map.parse(location);

  const data = spaces.find((space) => isEqual(engine.map.parse(space.coordinates), parsed));

  assert(data, `Impossible to place lost planet at ${location}`);

  const hex = engine.map.getS(location);
  hex.data.planet = Planet.Lost;

  // As the geometry of the universe changed, federations are possibly invalid.
  engine.players.forEach((p) => p.notifyOfNewPlanet(hex));

  engine.player(player).build(Building.Mine, hex, Reward.parse(data.cost), engine.map, 0);

  // will trigger a LeechPhase
  engine.leechSources.unshift({ player, coordinates: location });
}
