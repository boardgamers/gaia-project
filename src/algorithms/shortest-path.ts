import {Hex, Grid} from "hexagrid";

export default function shortestPath<T>(starts: Hex<T>[], dests: Hex<T>[], grid: Grid, costOf = (hex: Hex<T>) => 1): {path: Hex<T>[]; cost: number} {
  const destSet: Set<Hex<T>> = new Set(dests);
  const pathTo: Map<Hex<T>, {path: Hex<T>[]; cost: number}> = new Map();

  for (const start of starts) {
    pathTo.set(start, {path: [start], cost: costOf(start)});

    if (destSet.has(start)) {
      return {path: [start], cost: costOf(start)};
    }
  }

  let toExpand = starts;
  let toExpandNext = [];

  let minToDest = grid.size + 1;
  let bestPath: {path: Hex[]; cost: number};

  while (toExpand.length > 0) {
    for (const hex of toExpand) {
      const curPath = pathTo.get(hex);

      if (curPath.cost >= minToDest) {
        continue;
      }

      for (const neighbour of grid.neighbours(hex)) {
        if (pathTo.has(neighbour) && pathTo.get(neighbour).cost <= curPath.cost + costOf(neighbour)) {
          continue;
        }

        const extendedPath = {
          cost: curPath.cost + costOf(neighbour),
          path: [...curPath.path, neighbour]
        };

        pathTo.set(neighbour, extendedPath);
        toExpandNext.push(neighbour);

        if (destSet.has(neighbour) && extendedPath.cost < minToDest) {
          minToDest = extendedPath.cost;
          bestPath = extendedPath;
        }
      }
    }

    toExpand = toExpandNext;
    toExpandNext = [];
  }

  return bestPath;
}
