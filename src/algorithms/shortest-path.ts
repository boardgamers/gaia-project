import {Hex, Grid, CubeCoordinates} from "hexagrid";

export default function shortestPath(starts: Hex[], dests: Hex[], grid: Grid): Hex[] {
  const destSet: Set<Hex> = new Set(dests);
  const pathTo: Map<Hex, Hex[]> = new Map();

  for (const start of starts) {
    pathTo.set(start, [start]);

    if (destSet.has(start)) {
      return [start];
    }
  }

  let toExpand = starts;
  let toExpandNext = [];

  let minToDest = grid.size + 1;
  let bestPath: Hex[];

  while (toExpand.length > 0) {
    for (const hex of toExpand) {
      const curPath = pathTo.get(hex);

      if (curPath.length + 1 >= minToDest) {
        continue;
      }

      for (const neighbour of grid.neighbours(hex)) {
        if (pathTo.has(neighbour) && pathTo.get(neighbour).length <= curPath.length + 1) {
          continue;
        }

        const extendedPath = [].concat(curPath, [neighbour]);

        pathTo.set(neighbour, extendedPath);
        toExpandNext.push(neighbour);

        if (destSet.has(neighbour) && extendedPath.length < minToDest) {
          minToDest = extendedPath.length;
          bestPath = extendedPath;
        }
      }
    }

    toExpand = toExpandNext;
    toExpandNext = [];
  }

  return bestPath;
}
