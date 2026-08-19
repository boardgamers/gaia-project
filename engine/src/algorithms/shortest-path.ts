import { Grid, Hex } from "hexagrid";
import { difference, flatten } from "lodash";
import { topologyOf } from "./grid-topology";

/**
 * Find the cheapest path from any hex of `starts` to any hex of `dests`.
 *
 * Runs a BFS-style relaxation (all costs are non-negative, typically 0 or 1) over an
 * integer-indexed view of the grid, to keep the inner loop free of Map/Set lookups.
 *
 * @param costOf Cost of adding a hex to the path. Either a function, or a Float64Array
 * indexed like `topologyOf(grid).index()` (cheaper when calling repeatedly).
 * @param maxCost Paths costing more than this are not explored. If the cheapest path
 * exceeds it, undefined is returned. Defaults to unbounded.
 */
export default function shortestPath<T>(
  starts: Hex<T>[],
  dests: Hex<T>[],
  grid: Grid,
  costOf: ((hex: Hex<T>) => number) | Float64Array = () => 1,
  maxCost = Infinity
): { path: Hex<T>[]; cost: number } {
  const topology = topologyOf(grid as Grid<Hex<T>>);
  const { hexList, indexOf, neighbourIndices } = topology.index();
  const size = hexList.length;

  let hexCost: Float64Array;
  if (costOf instanceof Float64Array) {
    hexCost = costOf;
  } else {
    hexCost = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      hexCost[i] = costOf(hexList[i]);
    }
  }

  const isDest = new Uint8Array(size);
  for (const dest of dests) {
    const i = indexOf.get(dest);
    if (i !== undefined) {
      isDest[i] = 1;
    }
  }

  // Cheapest known cost to reach each hex, and the hex it was reached from
  const costTo = new Float64Array(size).fill(Infinity);
  const prev = new Int32Array(size).fill(-1);

  let toExpand: number[] = [];

  for (const start of starts) {
    const i = indexOf.get(start);
    if (i === undefined) {
      continue;
    }
    costTo[i] = hexCost[i];
    if (isDest[i]) {
      return { path: [start], cost: hexCost[i] };
    }
    toExpand.push(i);
  }

  let toExpandNext: number[] = [];

  let minToDest = size + 1;
  let bestPath: { path: Hex<T>[]; cost: number };
  let minDistance = 0;

  const pathTo = (index: number): Hex<T>[] => {
    const path: Hex<T>[] = [];
    for (let i = index; i !== -1; i = prev[i]) {
      path.push(hexList[i]);
    }
    return path.reverse();
  };

  const distanceToNextDest = (path: Hex<T>[], excl: Hex<T>[]) => {
    const targets = difference(dests, excl);

    if (targets.length === 0) {
      return 0;
    }

    path = bestPath ? difference(path, bestPath.path.slice(1, -1)) : path;

    return Math.min(...flatten(path.map((x) => targets.map((y) => topology.distance(x, y)))));
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
      const curCost = costTo[hex];

      if (curCost > minToDest) {
        continue;
      }

      for (const neighbour of neighbourIndices[hex]) {
        const cost = curCost + hexCost[neighbour];

        if (cost > maxCost) {
          // This path can never lead to a useful destination (costs are non-negative)
          continue;
        }

        if (costTo[neighbour] <= cost) {
          continue;
        }

        costTo[neighbour] = cost;
        prev[neighbour] = hex;
        toExpandNext.push(neighbour);

        if (isDest[neighbour]) {
          const extendedPath = { cost, path: pathTo(neighbour) };

          if (isBetter(extendedPath)) {
            minToDest = cost;
            bestPath = extendedPath;
            minDistance = distanceToNextDest(extendedPath.path.slice(1, -1), [
              extendedPath.path[0],
              extendedPath.path[extendedPath.path.length - 1],
            ]);
          }
        }
      }
    }

    toExpand = toExpandNext;
    toExpandNext = [];
  }

  return bestPath;
}
