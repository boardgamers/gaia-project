import { Grid, Hex } from "hexagrid";
import type Engine from "./engine";
import { LostFleetEconomySide, Planet, ScoringBoardExtensionSide } from "./enums";
import { GaiaHex } from "./gaia-hex";
import { lostFleetSectorTiles } from "./lost-fleet-board";
import {
  DEEP_SPACE_TILES,
  DEEP_SPACE_TILES_2P,
  findDeepSpaceNotches,
  findInterspaceHoles,
  interspaceSet,
  lostFleetSectorCenters,
} from "./lost-fleet-map";
import Sector from "./sector";
import type { SetupFactory } from "./setup";
import { SetupType } from "./setup";
import { shipsInPlay } from "./spaceships";
import assert from "./utils/assert";

export type LostFleetMapSetup = { sectors: string[]; interspace: string[]; deepSpace: string[] };

export function deepSpaceSetupFace(choice: string): Planet[] {
  const match = /^(1[1-8])([ab])([0-2])$/.exec(choice);
  assert(match, "Invalid Deep Space tile");
  const face = DEEP_SPACE_TILES.find((tile) => tile.id === Number(match[1]))[match[2]] as Planet[];
  return face.map((_, i) => face[(i + Number(match[3])) % 3]);
}

function rebuildMap(engine: Engine) {
  const draft = engine.lostFleetMapSetup;
  const centers = lostFleetSectorCenters(engine.players.length);
  const tiles = lostFleetSectorTiles(engine.players.length);
  const grid = new Grid<GaiaHex>();
  draft.sectors.forEach((name, i) => {
    for (const hex of Sector.create(tiles.find((tile) => tile.name === name).map, name, centers[i]).values()) {
      grid.push(hex);
    }
  });
  const holes = findInterspaceHoles(centers);
  const ships = shipsInPlay(engine.expansions, engine.players.length);
  draft.interspace.forEach((choice, i) => {
    const spaceship = ships.find((ship) => ship === choice);
    grid.push(
      new GaiaHex(holes[i].q, holes[i].r, {
        planet: spaceship ? Planet.Empty : (choice as Planet),
        sector: `IS${i}`,
        ...(spaceship ? { spaceship } : {}),
      })
    );
  });
  const notches = findDeepSpaceNotches(centers);
  draft.deepSpace.forEach((choice, i) => {
    const face = deepSpaceSetupFace(choice);
    notches[i].forEach((cell, j) =>
      grid.push(
        new GaiaHex(cell.q, cell.r, {
          planet: face[j],
          sector: `DS${choice.slice(0, 2)}_${j}`,
        })
      )
    );
  });
  grid.recalibrate();
  engine.map.grid = grid;
  engine.map.placement = {
    sectors: draft.sectors.map((sector, i) => ({ sector, rotation: 0, center: centers[i] })),
    mirror: false,
  };
  engine.options.map = engine.map.placement;
}

function interspaceOptions(engine: Engine): string[] {
  const draft = engine.lostFleetMapSetup.interspace;
  const set = interspaceSet(engine.players.length);
  const ships = shipsInPlay(engine.expansions, engine.players.length);
  const pool = [
    ...ships,
    ...Array(set.asteroid).fill(Planet.Asteroid),
    ...Array(set.protoplanet).fill(Planet.Protoplanet),
    ...Array(set.blank).fill(Planet.Empty),
  ];
  const remaining = pool.slice();
  for (const choice of draft) remaining.splice(remaining.indexOf(choice), 1);
  const holes = findInterspaceHoles(lostFleetSectorCenters(engine.players.length));
  const distance = (i: number, j: number) =>
    (Math.abs(holes[i].q - holes[j].q) + Math.abs(holes[i].r - holes[j].r) + Math.abs(holes[i].s - holes[j].s)) / 2;
  const isShip = (choice: string) => ships.some((ship) => ship === choice);
  const placedShips = draft.flatMap((choice, i) => (isShip(choice) ? [i] : []));
  const shipsLeft = remaining.filter(isShip).length;
  // A locally valid placement must also leave room for every remaining spaceship.
  const canFinish = (start: number, count: number, placed: number[]): boolean => {
    if (!count) return true;
    for (let i = start; i <= holes.length - count; i++) {
      if (placed.every((j) => distance(i, j) >= 4) && canFinish(i + 1, count - 1, [...placed, i])) return true;
    }
    return false;
  };
  return [...new Set<string>(remaining)].filter((choice) => {
    const placed = isShip(choice) ? [...placedShips, draft.length] : placedShips;
    return (
      (!isShip(choice) || placedShips.every((j) => distance(draft.length, j) >= 4)) &&
      canFinish(draft.length + 1, shipsLeft - Number(isShip(choice)), placed)
    );
  });
}

function deepSpaceOptions(engine: Engine): string[] {
  const draft = engine.lostFleetMapSetup.deepSpace;
  const notch = findDeepSpaceNotches(lostFleetSectorCenters(engine.players.length))[draft.length];
  return DEEP_SPACE_TILES.filter(
    (tile) =>
      (engine.players.length > 2 || DEEP_SPACE_TILES_2P.includes(tile.id)) &&
      !draft.some((choice) => choice.startsWith(String(tile.id)))
  )
    .flatMap((tile) => ["a", "b"].flatMap((side) => [0, 1, 2].map((rotation) => `${tile.id}${side}${rotation}`)))
    .filter((choice) =>
      deepSpaceSetupFace(choice).every(
        (planet, j, face) =>
          planet === Planet.Empty ||
          planet === Planet.Transdim ||
          (face.indexOf(planet) === j &&
            [...engine.map.grid.neighbours(new Hex(notch[j].q, notch[j].r))].every((hex) => hex.data.planet !== planet))
      )
    );
}

export function lostFleetSetupFactories(engine: Engine): SetupFactory[] {
  const count = engine.players.length;
  const selection = (
    type: SetupType,
    field: "scoringExtensionSide" | "lostFleetEconomySide",
    options: string[]
  ): SetupFactory => ({
    type,
    init: () => {
      delete engine[field];
    },
    nextAvailable: () => (engine[field] === undefined ? { position: 1, options } : null),
    applyOption: (option) => {
      if (field === "scoringExtensionSide") engine.scoringExtensionSide = option as ScoringBoardExtensionSide;
      else engine.lostFleetEconomySide = option as LostFleetEconomySide;
    },
  });
  const mapSelection = (
    type: SetupType,
    field: keyof LostFleetMapSetup,
    target: number,
    choices: () => string[]
  ): SetupFactory => ({
    type,
    init: () => undefined,
    nextAvailable: () =>
      engine.lostFleetMapSetup[field].length < target
        ? { position: engine.lostFleetMapSetup[field].length + 1, options: choices() }
        : null,
    applyOption: (option) => {
      engine.lostFleetMapSetup[field].push(String(option));
      rebuildMap(engine);
    },
  });
  return [
    selection(
      SetupType.ScoringExtensionSide,
      "scoringExtensionSide",
      count === 2 ? [ScoringBoardExtensionSide.VictoryPoints] : Object.values(ScoringBoardExtensionSide)
    ),
    selection(SetupType.EconomySide, "lostFleetEconomySide", Object.values(LostFleetEconomySide)),
    {
      type: SetupType.TerraformingColor,
      init: () => {
        engine.lostFleetTerraformingRow = [];
      },
      nextAvailable: () =>
        engine.lostFleetTerraformingRow.length < 7
          ? {
              position: engine.lostFleetTerraformingRow.length + 1,
              options: [
                Planet.Terra,
                Planet.Desert,
                Planet.Swamp,
                Planet.Oxide,
                Planet.Volcanic,
                Planet.Titanium,
                Planet.Ice,
              ].filter((planet) => !engine.lostFleetTerraformingRow.includes(planet)),
            }
          : null,
      applyOption: (option) => {
        engine.lostFleetTerraformingRow.push(option as Planet);
      },
    },
    {
      ...mapSelection(SetupType.MapTile, "sectors", lostFleetSectorCenters(count).length, () => {
        const used = engine.lostFleetMapSetup.sectors;
        return lostFleetSectorTiles(count)
          .map((tile) => tile.name)
          .filter(
            (name) =>
              !used.includes(name) &&
              (!engine.options.officialCenterSectors ||
                used.length >= (count === 4 ? 2 : 1) ||
                ["1", "2", "3", "4"].includes(name))
          );
      }),
      init: () => {
        engine.lostFleetMapSetup = { sectors: [], interspace: [], deepSpace: [] };
        rebuildMap(engine);
      },
    },
    mapSelection(SetupType.InterspaceTile, "interspace", interspaceSet(count).total, () => interspaceOptions(engine)),
    mapSelection(SetupType.DeepSpaceTile, "deepSpace", findDeepSpaceNotches(lostFleetSectorCenters(count)).length, () =>
      deepSpaceOptions(engine)
    ),
  ];
}
