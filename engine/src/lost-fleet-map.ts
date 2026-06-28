import { CubeCoordinates, Hex } from "hexagrid";
import { Planet, Spaceship } from "./enums";

/**
 * Lost Fleet "Variable Gameboard Layout" geometry + tile data.
 *
 * This module is self-contained map *content* for the Lost Fleet expansion: it produces the
 * shifted sector-center layouts for 2/3/4 players, locates the Interspace (single-hex) holes and
 * Deep Space (3-hex triangle) notches those layouts create, and carries the Interspace/Deep Space
 * tile composition data. It deliberately does NOT touch the base-game `SpaceMap` generation so the
 * existing engine tests stay valid; wiring these layouts into a playable `SpaceMap` is a later step.
 *
 * Geometry has been verified against the rulebook diagrams (rulebook-v1.0 p.4-5): every layout
 * produces exactly the rulebook's stated number of single-hex Interspace holes with no spurious
 * multi-hex clusters in the interior, and the Deep Space notch count matches the physical tile count
 * placed at each player count. See docs/lost-fleet/RULES_CLARIFICATIONS.md §H1-H5.
 */

/** Each Space Sector tile is a radius-2 hexagon (19 hexes), same as the base game. */
export const SECTOR_RADIUS = 2;

/**
 * Base-game "matched" adjacency: two sectors share a full edge (distance 5, edges line up). Kept for
 * reference / comparison only — the Lost Fleet layout never uses matched outer placement.
 */
export const MATCHED_OFFSET: CubeCoordinates = { q: 5, r: -2, s: -3 };

/**
 * Lost Fleet "slid one space" adjacency: an outer sector borders an inner sector along only 2 spaces
 * (the rulebook's "do not match up those sectors... slide them all one space to the left or right").
 * Still distance 5, but rotated by one, which opens a clean single-hex hole at the seam.
 */
export const SHIFTED_OFFSET: CubeCoordinates = { q: 5, r: -1, s: -4 };

const CUBE_DIRECTIONS: CubeCoordinates[] = [
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
  { q: 1, r: -1, s: 0 },
];

function key(c: CubeCoordinates): string {
  return `${c.q}x${c.r}`;
}

function add(a: CubeCoordinates, b: CubeCoordinates): CubeCoordinates {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

function neighbours(c: CubeCoordinates): CubeCoordinates[] {
  return CUBE_DIRECTIONS.map((d) => add(c, d));
}

/** The shifted offset rotated `times` 60° steps clockwise (uses the same rotation as the engine grid). */
function shiftedOffset(times: number): CubeCoordinates {
  const hex = new Hex(SHIFTED_OFFSET.q, SHIFTED_OFFSET.r);
  hex.rotateRight(times);
  return { q: hex.q, r: hex.r, s: hex.s };
}

/** All 19 hex coordinates of the radius-2 sector centred on `center`. */
export function sectorHexes(center: CubeCoordinates): CubeCoordinates[] {
  return Hex.hexagon(SECTOR_RADIUS, { center }).map((h) => ({ q: h.q, r: h.r, s: h.s }));
}

const ORIGIN: CubeCoordinates = { q: 0, r: 0, s: 0 };

/**
 * Sector centres for the Lost Fleet variable layout at a given player count.
 *
 * - 2p: 1 inner sector + 6 outer sectors slid one space (7 sectors).
 * - 3p: 1 inner + 6 outer + 2 extra, all slid the same way (9 sectors).
 * - 4p: 2 adjacent inner sectors + 8 outer sectors slid one space (10 sectors).
 *
 * The returned order is geometric only; physical sector-tile identity (01-10) is assigned randomly at
 * setup, so callers should not attach meaning to the index.
 */
export function lostFleetSectorCenters(nbPlayers: number): CubeCoordinates[] {
  if (nbPlayers <= 2) {
    // inner + 6 shifted ring
    return [ORIGIN, ...[0, 1, 2, 3, 4, 5].map((i) => shiftedOffset(i))];
  }

  if (nbPlayers === 3) {
    // inner + 6 shifted ring + 2 extra "edge" sectors extending the ring on one side
    const ring = [0, 1, 2, 3, 4, 5].map((i) => shiftedOffset(i));
    const extra1 = add(shiftedOffset(0), shiftedOffset(1));
    const extra2 = add(shiftedOffset(1), shiftedOffset(2));
    return [ORIGIN, ...ring, extra1, extra2];
  }

  // 4p: two inner hubs placed adjacent, each carrying shifted outer sectors.
  const hubA = ORIGIN;
  const hubB = add(hubA, shiftedOffset(0));
  return [
    hubA,
    hubB,
    add(hubA, shiftedOffset(2)),
    add(hubA, shiftedOffset(3)),
    add(hubA, shiftedOffset(4)),
    add(hubB, shiftedOffset(5)),
    add(hubB, shiftedOffset(0)),
    add(hubB, shiftedOffset(1)),
    add(hubA, shiftedOffset(1)),
    add(hubB, shiftedOffset(4)),
  ];
}

interface HaloInfo {
  /** Empty cell key -> set of distinct sector indices it borders. */
  touch: Map<string, Set<number>>;
  cells: Map<string, CubeCoordinates>;
}

function buildHalo(centers: CubeCoordinates[]): HaloInfo {
  const occupied = new Set<string>();
  for (const c of centers) for (const h of sectorHexes(c)) occupied.add(key(h));

  const touch = new Map<string, Set<number>>();
  const cells = new Map<string, CubeCoordinates>();
  centers.forEach((c, idx) => {
    for (const h of sectorHexes(c)) {
      for (const n of neighbours(h)) {
        const k = key(n);
        if (occupied.has(k)) continue;
        if (!touch.has(k)) {
          touch.set(k, new Set());
          cells.set(k, n);
        }
        touch.get(k).add(idx);
      }
    }
  });
  return { touch, cells };
}

/** Connected components (hex adjacency) of a set of cells, largest first. */
function components(cellKeys: Set<string>, cells: Map<string, CubeCoordinates>): string[][] {
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const start of cellKeys) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const comp: string[] = [];
    while (stack.length) {
      const ck = stack.pop();
      comp.push(ck);
      for (const n of neighbours(cells.get(ck))) {
        const nk = key(n);
        if (cellKeys.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    comps.push(comp);
  }
  comps.sort((a, b) => b.length - a.length);
  return comps;
}

/**
 * The single-hex interior holes (Interspace tile slots) for a layout: bounded, isolated empty cells
 * nestled between sectors. Excludes the unbounded outer region. The count equals the rulebook's
 * stated number of Interspace tiles (6 / 8 / 10 for 2 / 3 / 4 players).
 */
export function findInterspaceHoles(centers: CubeCoordinates[]): CubeCoordinates[] {
  const { touch, cells } = buildHalo(centers);
  const haloKeys = new Set(touch.keys());
  const comps = components(haloKeys, cells);
  // comps[0] is the unbounded outer region; every other component is interior.
  const interior = comps.slice(1);
  return interior.filter((c) => c.length === 1).map((c) => cells.get(c[0]));
}

/**
 * The Deep Space notches (3-hex triangle slots) around the outside edge: each sits in the perimeter
 * wedge between an adjacent pair of outer sectors. Returns one triangle (3 coordinates) per notch.
 * The count equals the number of Deep Space tiles physically placed (6 / 8 / 8 for 2 / 3 / 4 players).
 */
export function findDeepSpaceNotches(centers: CubeCoordinates[]): CubeCoordinates[][] {
  const { touch, cells } = buildHalo(centers);
  const haloKeys = new Set(touch.keys());
  const comps = components(haloKeys, cells);
  const outer = new Set(comps[0]); // unbounded region
  // notch seeds = outer-region cells that border >=2 distinct sectors (the inner corner of the wedge)
  const seeds = [...outer].filter((k) => touch.get(k).size >= 2);

  return seeds.map((seedKey) => {
    const seed = cells.get(seedKey);
    const outerNeighbours = neighbours(seed).filter((n) => outer.has(key(n)));
    // complete the triangle: two outer neighbours of the seed that are also adjacent to each other
    for (let i = 0; i < outerNeighbours.length; i++) {
      for (let j = i + 1; j < outerNeighbours.length; j++) {
        if (neighbours(outerNeighbours[i]).some((n) => key(n) === key(outerNeighbours[j]))) {
          return [seed, outerNeighbours[i], outerNeighbours[j]];
        }
      }
    }
    return [seed];
  });
}

/**
 * Pairs of Deep Space notches (from `findDeepSpaceNotches`) that are themselves hex-adjacent to each
 * other, forming one larger contiguous gap. This is a fixed structural property of the sector-center
 * geometry (centers are never randomized, only tile identity/rotation is), so it is the same in every
 * game at a given player count.
 *
 * Implements the rulebook's 3p-only "place 2 Deep Space Sector tiles next to each other in the larger
 * gap by the sector you placed last" rule (§H1): there is exactly one such adjacent pair at 3 players,
 * and none at 2 or 4 players, which already matches the rule's player-count scope without any extra
 * "last placed sector" bookkeeping. See RULES_CLARIFICATIONS.md §H1 note 4.
 */
export function findAdjacentNotchPairs(centers: CubeCoordinates[]): Array<[number, number]> {
  const notches = findDeepSpaceNotches(centers);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < notches.length; i++) {
    for (let j = i + 1; j < notches.length; j++) {
      const adjacent = notches[i].some((a) => notches[j].some((b) => neighbours(a).some((n) => key(n) === key(b))));
      if (adjacent) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

/**
 * Lost Fleet hex classification, distinguishing a regular 19-hex Space Sector tile from the single-hex
 * Interspace holes and 3-hex Deep Space notches that fill the gaps the shifted layout creates.
 * Needed for effects that key off sector type (e.g. Darkanians' Planetary Institute ability).
 */
export enum LostFleetSectorType {
  Space = "space",
  DeepSpace = "deepSpace",
  Interspace = "interspace",
}

/** Sector ids for Interspace/Deep Space hexes follow the `IS<n>`/`DS<tileId>` convention (see lost-fleet-board.ts). */
export function classifySectorId(sector: string): LostFleetSectorType {
  if (sector.startsWith("IS")) {
    return LostFleetSectorType.Interspace;
  }
  if (sector.startsWith("DS")) {
    return LostFleetSectorType.DeepSpace;
  }
  return LostFleetSectorType.Space;
}

/** A single face (3 hexes) of a Deep Space Sector tile. Each hex is one of Protoplanet/Asteroid/Transdim/Empty. */
export type DeepSpaceFace = [Planet, Planet, Planet];

export interface DeepSpaceTile {
  /** Physical tile number, 11-18. (2p uses only 11-16; 3p/4p use all 8.) */
  id: number;
  a: DeepSpaceFace;
  b: DeepSpaceFace;
}

const P = Planet.Protoplanet;
const A = Planet.Asteroid;
const M = Planet.Transdim;
const B = Planet.Empty; // "Blank" Deep Space hex

/** Deep Space Sector tiles, both faces. Source: RULES_CLARIFICATIONS.md §H2 (BOARD-ART, CONFIRMED). */
export const DEEP_SPACE_TILES: DeepSpaceTile[] = [
  { id: 11, a: [P, A, B], b: [A, B, B] },
  { id: 12, a: [M, P, B], b: [A, B, B] },
  { id: 13, a: [M, B, A], b: [B, B, A] },
  { id: 14, a: [P, B, A], b: [B, B, A] },
  { id: 15, a: [P, B, B], b: [P, B, A] },
  { id: 16, a: [B, B, P], b: [A, B, A] },
  { id: 17, a: [M, B, B], b: [B, A, B] },
  { id: 18, a: [P, B, B], b: [A, B, B] },
];

/** The 6 Deep Space tiles a 2-player game uses (the rest stay in the box at 2p). Source: §H1. */
export const DEEP_SPACE_TILES_2P: readonly number[] = [11, 12, 13, 14, 15, 16];

/** What is printed on the front face of an Interspace tile. */
export enum InterspaceContent {
  Spaceship = "spaceship",
  Asteroid = "asteroid",
  Protoplanet = "protoplanet",
  Blank = "blank",
}

export interface InterspaceSet {
  asteroid: number;
  protoplanet: number;
  /** Number of Lost Fleet spaceship tiles in the set. */
  spaceships: number;
  /** Which ships are excluded from this set's spaceship tiles. */
  excludedShips: Spaceship[];
  blank: number;
  total: number;
}

/**
 * Interspace tile composition per player-count set. Source: RULES_CLARIFICATIONS.md §H3
 * (BOARD-ART, owner-CONFIRMED). Only aggregate counts matter — tiles are placed at random.
 */
export const INTERSPACE_SETS: { [nbPlayers: number]: InterspaceSet } = {
  2: { asteroid: 2, protoplanet: 1, spaceships: 3, excludedShips: [Spaceship.Rebellion], blank: 0, total: 6 },
  3: { asteroid: 2, protoplanet: 1, spaceships: 4, excludedShips: [], blank: 1, total: 8 },
  4: { asteroid: 4, protoplanet: 1, spaceships: 4, excludedShips: [], blank: 1, total: 10 },
};

/** The Interspace tile set for a player count (2-4). */
export function interspaceSet(nbPlayers: number): InterspaceSet {
  const set = INTERSPACE_SETS[Math.min(Math.max(nbPlayers, 2), 4)];
  return set;
}

/** Number of Deep Space tiles actually placed at a given player count (6 at 2p, 8 at 3p/4p). Source: §H1. */
export function deepSpaceTileCount(nbPlayers: number): number {
  return nbPlayers <= 2 ? 6 : 8;
}

/**
 * §H4 — TODO [BOARD-ART revised sectors].
 *
 * Sectors 05, 06 and 07 are double-sided in the Lost Fleet expansion: the base-game "white numbers"
 * face is used at 4p (already covered by the base-game sector maps in map.ts), but at 2p/3p they are
 * flipped to a Lost-Fleet-specific "black numbers outlined in white" revised face whose planet layout
 * is NOT yet captured from the physical components. Until the owner supplies the revised-side art,
 * 2p/3p games must fall back to the base-game face for these three sectors.
 *
 * See docs/lost-fleet/RULES_CLARIFICATIONS.md §H4 and docs/lost-fleet/COMPONENTS.md.
 */
export const REVISED_SECTOR_FACES_TODO = {
  sectorsNeedingRevisedFace: ["5", "6", "7"],
  usedAtPlayerCounts: [2, 3],
  /** When true, a revised planet layout exists; until then callers use the base-game face. */
  available: false,
} as const;
