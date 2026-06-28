import { CubeCoordinates, Grid } from "hexagrid";
import seedrandom from "seedrandom";
import shuffleSeed from "shuffle-seed";
import { Expansion, Planet, Spaceship } from "./enums";
import { GaiaHex } from "./gaia-hex";
import {
  DEEP_SPACE_TILES,
  DEEP_SPACE_TILES_2P,
  DeepSpaceFace,
  findAdjacentNotchPairs,
  findDeepSpaceNotches,
  findInterspaceHoles,
  interspaceSet,
  lostFleetSectorCenters,
} from "./lost-fleet-map";
import { MapTile, s1, s2, s3, s4, s5, s5b, s6, s6b, s7, s7b, s8, s9, s10 } from "./map";
import Sector from "./sector";
import { shipsInPlay } from "./spaceships";

/**
 * Lost Fleet "Variable Gameboard Layout" board assembly: turns the geometry/tile data in
 * `lost-fleet-map.ts` into an actual `Grid<GaiaHex>`, following the same pattern as
 * `bigConfiguration`/`smallConfiguration` in `map.ts`. Standalone and seed-deterministic; not wired
 * into `SpaceMap`/`moveInit` (see docs/lost-fleet/RULES_CLARIFICATIONS.md §H1 note 7 for why: the
 * existing `GaiaHex` addressing system assumes the base game's sector spacing and needs a separate fix
 * first).
 */

/**
 * Space Sector tiles used at each player count, per §H1: 2p uses 01-07, 3p uses 01-10 except 08, 4p
 * uses all 10. Sectors 05/06/07 use the base game's existing per-count face choice as a stand-in for
 * the not-yet-available Lost Fleet revised face (§H4): B-side for 2p/3p, A-side for 4p.
 */
function lostFleetSectorTiles(nbPlayers: number): MapTile[] {
  if (nbPlayers <= 2) {
    return [s1, s2, s3, s4, s5b, s6b, s7b];
  }
  if (nbPlayers === 3) {
    return [s1, s2, s3, s4, s5b, s6b, s7b, s9, s10];
  }
  return [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];
}

/** Step 1: place the (rotated) Space Sector tiles onto the shifted Lost Fleet centers. */
function generateSectorGrid(nbPlayers: number, rng: seedrandom.prng): Grid<GaiaHex> {
  const centers = lostFleetSectorCenters(nbPlayers);
  const tiles = shuffleSeed.shuffle(lostFleetSectorTiles(nbPlayers), rng());

  const grids = tiles.map((tile, i) =>
    Sector.create(tile.map, tile.name, centers[i]).rotateRight(Math.floor(rng() * 6), centers[i])
  );
  const [first, ...rest] = grids;
  return first.merge(...rest);
}

/** Content tags for a single Interspace tile, before a specific ship/coordinate is assigned. */
type InterspaceTag = { planet: Planet; spaceship?: Spaceship };

/**
 * Step 2: build the randomized Interspace tile pool for a player count (per §H3's per-set
 * composition), with specific ship identities drawn from the ships actually in play (excludes
 * Rebellion at 2p, same as `shipsInPlay`).
 */
function interspaceTags(nbPlayers: number, rng: seedrandom.prng): InterspaceTag[] {
  const set = interspaceSet(nbPlayers);
  const ships = shuffleSeed.shuffle(shipsInPlay(Expansion.LostFleet, nbPlayers), rng());

  const tags: InterspaceTag[] = [
    ...ships.map((spaceship) => ({ planet: Planet.Empty, spaceship })),
    ...Array(set.asteroid).fill({ planet: Planet.Asteroid }),
    ...Array(set.protoplanet).fill({ planet: Planet.Protoplanet }),
    ...Array(set.blank).fill({ planet: Planet.Empty }),
  ];
  return tags;
}

/** Hex-distance bound from RULES_CLARIFICATIONS.md §H1 note 3: the 2p "≥5 spaces" and 3-4p "not within
 * 3 spaces" wordings are the same constraint (no hole pair is ever at distance 4). */
const MIN_SPACESHIP_DISTANCE = 4;

function dist(a: CubeCoordinates, b: CubeCoordinates): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * Choose which holes (by index) get the spaceship tags, such that no two are within
 * `MIN_SPACESHIP_DISTANCE` of each other. Rejection sampling: ~7-10% of random subsets are valid at
 * every player count (verified empirically), so this converges quickly.
 */
function pickSpaceshipHoles(holes: CubeCoordinates[], count: number, rng: seedrandom.prng): number[] {
  const indices = holes.map((_, i) => i);
  const maxAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = shuffleSeed.shuffle(indices, rng() + attempt).slice(0, count);
    let valid = true;
    for (let i = 0; i < candidate.length && valid; i++) {
      for (let j = i + 1; j < candidate.length; j++) {
        if (dist(holes[candidate[i]], holes[candidate[j]]) < MIN_SPACESHIP_DISTANCE) {
          valid = false;
          break;
        }
      }
    }
    if (valid) {
      return candidate;
    }
  }

  throw new Error("Could not find a valid spaceship tile arrangement satisfying the spacing rule");
}

/** Step 2 (placement): fill the Interspace holes with the tag pool, respecting the spacing rule. */
function placeInterspaceTiles(grid: Grid<GaiaHex>, nbPlayers: number, rng: seedrandom.prng) {
  const centers = lostFleetSectorCenters(nbPlayers);
  const holes = findInterspaceHoles(centers);
  const tags = interspaceTags(nbPlayers, rng);
  const spaceshipTags = tags.filter((t) => t.spaceship !== undefined);
  const otherTags = shuffleSeed.shuffle(
    tags.filter((t) => t.spaceship === undefined),
    rng()
  );

  const spaceshipHoleIndices = new Set(pickSpaceshipHoles(holes, spaceshipTags.length, rng));
  const shuffledSpaceshipTags = shuffleSeed.shuffle(spaceshipTags, rng());

  let spaceshipCursor = 0;
  let otherCursor = 0;
  holes.forEach((hole, i) => {
    const tag = spaceshipHoleIndices.has(i)
      ? shuffledSpaceshipTags[spaceshipCursor++]
      : otherTags[otherCursor++];
    grid.push(new GaiaHex(hole.q, hole.r, { planet: tag.planet, sector: `IS${i}`, spaceship: tag.spaceship }));
  });
}

/** Step 3 (placement): fill the Deep Space notches with randomized tile faces. */
function placeDeepSpaceTiles(grid: Grid<GaiaHex>, nbPlayers: number, rng: seedrandom.prng) {
  const centers = lostFleetSectorCenters(nbPlayers);
  const notches = findDeepSpaceNotches(centers);
  const tilePool = nbPlayers <= 2 ? DEEP_SPACE_TILES.filter((t) => DEEP_SPACE_TILES_2P.includes(t.id)) : DEEP_SPACE_TILES;
  const tiles = shuffleSeed.shuffle(tilePool, rng());

  // One tile per notch. At 3p exactly one pair of notches is itself hex-adjacent (§H1 note 4), which
  // is the rulebook's "larger gap" -- no special-cased placement is needed, it falls out of the
  // 1-tile-per-notch assignment for free; see findAdjacentNotchPairs for the regression-tested property.
  notches.forEach((notch, i) => {
    const tile = tiles[i];
    const side: "a" | "b" = rng() < 0.5 ? "a" : "b";
    const face: DeepSpaceFace = tile[side];
    notch.forEach((cell, j) => {
      grid.push(new GaiaHex(cell.q, cell.r, { planet: face[j], sector: `DS${tile.id}` }));
    });
  });
}

export interface LostFleetBoard {
  grid: Grid<GaiaHex>;
  /** Pairs of Deep Space notch indices that are hex-adjacent (the 3p-only "larger gap"; empty at 2p/4p). */
  adjacentNotchPairs: Array<[number, number]>;
}

/** Builds a complete, seed-deterministic Lost Fleet board: Space Sectors + Interspace + Deep Space. */
export function generateLostFleetBoard(nbPlayers: number, seed: string): LostFleetBoard {
  const rng = seedrandom(seed);
  const grid = generateSectorGrid(nbPlayers, rng);
  placeInterspaceTiles(grid, nbPlayers, rng);
  placeDeepSpaceTiles(grid, nbPlayers, rng);

  return { grid, adjacentNotchPairs: findAdjacentNotchPairs(lostFleetSectorCenters(nbPlayers)) };
}
