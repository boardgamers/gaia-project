import { isEqual } from "lodash";
import { AvailableBuilding, AvailableCommand } from "../available/types";
import Engine from "../engine";
import { Building, Command, Phase, Planet, Player as PlayerEnum, Resource } from "../enums";
import Player from "../player";
import Reward from "../reward";
import assert from "../utils/assert";

/**
 * Qualifier that may follow the location on a build move, as in `build ts 1x2 cheap`. Purely
 * produced by the planning viewer. In a simulation it selects the assumed-neighbour price; in a
 * real turn or premove it requires a Trading Station costing at most 3 credits. It never grants a
 * discount that is not already available on the real board.
 *
 * Matched positionally - the first argument after the location - and NOT by scanning every trailing
 * token: build moves already carry log annotations there (`build gf 6A9 using area1: 6.`), which
 * `moveBuild` has always ignored and must keep ignoring.
 */
export const ANALYSIS_CHEAP_BUILD = "cheap";

export function moveBuild(
  engine: Engine,
  command: AvailableCommand<Command.Build>,
  player: PlayerEnum,
  building: Building,
  location: string,
  qualifier?: string
) {
  const { buildings } = command.data;
  const parsed = engine.map.parse(location);
  const pl = engine.player(player);
  const wantCheap = qualifier === ANALYSIS_CHEAP_BUILD;

  for (const elem of buildings) {
    const matchesPrice = wantCheap
      ? elem.building === Building.TradingStation &&
        Reward.parse(elem.cost)
          .filter((cost) => cost.type === Resource.Credit)
          .reduce((sum, cost) => sum + cost.count, 0) <= 3
      : !elem.analysisCheap;
    if (elem.building === building && matchesPrice && isEqual(engine.map.parse(elem.coordinates), parsed)) {
      placeBuilding(engine, pl, elem);
      return;
    }
  }

  assert(
    false,
    wantCheap
      ? `The Trading Station at ${location} is not available for 3c.`
      : `Impossible to execute build command at ${location}, available: ${buildings.map((b) => b.coordinates)}`
  );
}

export function placeBuilding(engine: Engine, pl: Player, building: AvailableBuilding) {
  const hex = engine.map.getS(building.coordinates);
  pl.build(
    building.building,
    hex,
    Reward.parse(building.cost),
    engine.map,
    building.steps,
    building.consumesAsteroidGaiaformer ?? true
  );

  // will trigger a LeechPhase
  if (engine.phase === Phase.RoundMove) {
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
  assert(!hex.hasSpaceship(), "Can't place the Lost Planet on a spaceship hex");
  hex.data.planet = Planet.Lost;

  // As the geometry of the universe changed, federations are possibly invalid.
  engine.players.forEach((p) => p.notifyOfNewPlanet(hex));

  engine.player(player).build(Building.Mine, hex, Reward.parse(data.cost), engine.map, 0);

  // will trigger a LeechPhase
  engine.leechSources.unshift({ player, coordinates: location });
}
