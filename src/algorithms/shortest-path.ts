import { Hex, Grid } from "hexagrid";
import { flatten, difference } from "lodash";

export default function shortestPath<T>(
  starts: Hex<T>[],
  dests: Hex<T>[],
  grid: Grid,
  costOf = (hex: Hex<T>) => 1
): { path: Hex<T>[]; cost: number } {
  const destSet: Set<Hex<T>> = new Set(dests);
  const pathTo: Map<Hex<T>, { path: Hex<T>[]; cost: number }> = new Map();

  for (const start of starts) {
    pathTo.set(start, { path: [start], cost: costOf(start) });

    if (destSet.has(start)) {
      return { path: [start], cost: costOf(start) };
    }
  }

  let toExpand = starts;
  let toExpandNext = [];

  let minToDest = grid.size + 1;
  let bestPath: { path: Hex<T>[]; cost: number };
  let minDistance = 0;

  const distanceToNextDest = (path: Hex<T>[], excl: Hex<T>[]) => {
    const targets = difference(dests, excl);

    if (targets.length === 0) {
      return 0;
    }

    path = bestPath ? difference(path, bestPath.path.slice(1, -1)) : path;

    return Math.min(...flatten(path.map((x) => targets.map((y) => grid.distance(x, y)))));
  };

  const isBetter = (path: { path: Hex<T>[]; cost: number }) => {
    if (path.cost < minToDest) {
      return true;
    }
    if (path.cost > minToDest) {
      return false;
    }

    // We calculate the min distance between an hex of the path and other dest hexes
    // Better but more costly would be to use shortestPath instead of distance calculation
    return distanceToNextDest(path.path, [path.path[0], path.path[path.path.length]]) < minDistance;
  };

  while (toExpand.length > 0) {
    for (const hex of toExpand) {
      const curPath = pathTo.get(hex);

      if (curPath.cost > minToDest) {
        continue;
      }

      for (const neighbour of grid.neighbours(hex)) {
        if (pathTo.has(neighbour) && pathTo.get(neighbour).cost <= curPath.cost + costOf(neighbour)) {
          continue;
        }

        const extendedPath = {
          cost: curPath.cost + costOf(neighbour),
          path: [...curPath.path, neighbour],
        };

        pathTo.set(neighbour, extendedPath);
        toExpandNext.push(neighbour);

        if (destSet.has(neighbour) && isBetter(extendedPath)) {
          minToDest = extendedPath.cost;
          bestPath = extendedPath;
          minDistance = distanceToNextDest(extendedPath.path.slice(1, -1), [
            extendedPath.path[0],
            extendedPath.path[extendedPath.path.length - 1],
          ]);
        }
      }
    }

    toExpand = toExpandNext;
    toExpandNext = [];
  }

  return bestPath;
}
