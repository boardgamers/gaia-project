import { factionPlanet, GaiaHex, Player } from "@gaia-project/engine";
import { Direction, Grid } from "hexagrid";
import { CubeCoordinatesPartial } from "hexagrid/src/cubecoordinates";

export type FederationLine = { rotate: number; id: string };

const vSpacing = Math.sqrt(3) / 2;

export function hexCenter(hex: CubeCoordinatesPartial, radius = 1) {
  return {
    x: hex.r * 1.5 * radius,
    y: -(2 * hex.q + hex.r) * vSpacing * radius,
  };
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

function rotate(direction: Direction): number {
  return Math.log2(direction) * 60 + 180;
}

export function playerFederationLines(grid: Grid<GaiaHex>, hex: GaiaHex, player: Player): FederationLine[] {
  const directions = Direction.list().filter((d) => grid.neighbour(hex, d)?.federations?.includes(player.player));

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
        id: `#federation-arc-${factionPlanet(player.faction)}`,
        rotate: rotate(direction),
      });
    }
  }

  const building = hex.colonizedBy(player.player);

  return directions
    .flatMap((direction) => {
      const gaiaHex = grid.neighbour(hex, direction);
      const big = gaiaHex.colonizedBy(player.player) && building;
      if (!big && skipped.includes(direction)) {
        return [];
      }
      const line = big ? "big-line" : "line";
      return [
        {
          rotate: rotate(direction),
          id: `#federation-${line}-${factionPlanet(player.faction)}`,
        },
      ];
    })
    .concat(arcs);
}
