import { classifySectorId, GaiaHex, LostFleetSectorType, Player } from "@gaia-project/engine";
import { lostFleetSectorKey } from "@gaia-project/engine/src/lost-fleet-map";
import { Direction, Grid } from "hexagrid";
import { CubeCoordinatesPartial } from "hexagrid/src/cubecoordinates";
import { factionColor, lightenDarkenColor } from "./utils";

export type FederationLine = { path: string; color: string };

const vSpacing = Math.sqrt(3) / 2;

/**
 * The 1% the whole board is spread by, so neighbouring hexes show a hairline gap instead of sharing
 * an edge exactly. Applied to every top-level placement (sectors, loose hexes and the power-ring
 * overlay) - anything positioned without it drifts off the grid the further it sits from the origin.
 */
export const HEX_SPREAD = 1.01;

export function hexCenter(hex: CubeCoordinatesPartial, radius = 1) {
  return {
    x: hex.r * 1.5 * radius,
    y: -(2 * hex.q + hex.r) * vSpacing * radius,
  };
}

/** A tiny rigid translation of each physical Deep Space tile away from its neighbouring
 * regular sectors. Derive the outward direction from the local notch, not the board origin:
 * the asymmetric 3/4-player boards also have notches along their sides. */
export function deepSpaceOffset(hex: GaiaHex, grid?: Grid<GaiaHex>) {
  if (!grid || classifySectorId(hex.data.sector) !== LostFleetSectorType.DeepSpace) return { x: 0, y: 0 };
  const tile = [...grid.values()].filter((other) => lostFleetSectorKey(other) === lostFleetSectorKey(hex));
  // Sum distinct boundary normals rather than weighting by the number of touching
  // cells. The notch has opposing side walls: their normals cancel, leaving the
  // opening direction (so sliding outward never narrows either side wall).
  const normals = new Map<string, { x: number; y: number }>();
  for (const cell of tile) {
    for (const neighbour of grid.neighbours(cell)) {
      if (classifySectorId(neighbour.data.sector) !== LostFleetSectorType.Space) continue;
      const q = cell.q - neighbour.q;
      const r = cell.r - neighbour.r;
      normals.set(`${q},${r}`, hexCenter({ q, r }));
    }
  }
  const dx = [...normals.values()].reduce((sum, p) => sum + p.x, 0);
  const dy = [...normals.values()].reduce((sum, p) => sum + p.y, 0);
  const length = Math.hypot(dx, dy);
  return length ? { x: (dx / length) * 0.035, y: (dy / length) * 0.035 } : { x: 0, y: 0 };
}

/** Sectors are spread apart as whole tiles; their internal hex spacing stays unchanged. */
export function displayedHexCenter(hex: GaiaHex, grid?: Grid<GaiaHex>) {
  const point = hexCenter(hex);
  if (classifySectorId(hex.data.sector) !== LostFleetSectorType.Space) {
    const offset = deepSpaceOffset(hex, grid);
    return { x: point.x * HEX_SPREAD + offset.x, y: point.y * HEX_SPREAD + offset.y };
  }
  const relative = hex.relativeCoordinates;
  const center = hexCenter({ q: hex.q - relative.q, r: hex.r - relative.r });
  return { x: point.x + center.x * (HEX_SPREAD - 1), y: point.y + center.y * (HEX_SPREAD - 1) };
}

export function corners(radius = 1) {
  return [
    { x: -radius, y: 0 },
    { x: -radius / 2, y: -vSpacing * radius },
    { x: radius / 2, y: -vSpacing * radius },
    { x: radius, y: 0 },
    { x: radius / 2, y: vSpacing * radius },
    { x: -radius / 2, y: vSpacing * radius },
  ];
}

function rotateRight(d: Direction, times: number): Direction {
  if (times == 0) {
    return d;
  }
  return rotateRight(d == Direction.NorthWest ? Direction.North : 2 * d, times - 1);
}

export function playerFederationLines(grid: Grid<GaiaHex>, hex: GaiaHex, player: Player): FederationLine[] {
  const directions = Direction.list().filter((d) => grid.neighbour(hex, d)?.federations?.includes(player.player));
  const center = displayedHexCenter(hex, grid);
  const color = lightenDarkenColor(factionColor(player.faction), 30);
  const midpoint = (direction: Direction) => {
    const neighbour = displayedHexCenter(grid.neighbour(hex, direction), grid);
    return `${(neighbour.x - center.x) / 2} ${(neighbour.y - center.y) / 2}`;
  };

  const arcs: FederationLine[] = [];
  const skipped: Direction[] = [];
  for (const direction of directions) {
    const r = rotateRight(direction, 2);

    if (directions.includes(r)) {
      if (!directions.includes(rotateRight(direction, 3))) {
        skipped.push(direction);
      }
      if (!directions.includes(rotateRight(direction, 5))) {
        skipped.push(r);
      }
      arcs.push({
        path: `M ${midpoint(direction)} Q 0 0 ${midpoint(r)}`,
        color,
      });
    }
  }

  const building = hex.colonizedBy(player.player);

  return directions
    .flatMap((direction) => {
      const gaiaHex = grid.neighbour(hex, direction);
      const connectsBuildings = gaiaHex.colonizedBy(player.player) && building;
      if (!connectsBuildings && skipped.includes(direction)) {
        return [];
      }
      return [
        {
          path: `M 0 0 L ${midpoint(direction)}`,
          color,
        },
      ];
    })
    .concat(arcs);
}
