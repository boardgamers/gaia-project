import assert from "assert";
import { Grid, Hex } from "hexagrid";
import { difference, inRange, maxBy, minBy, sumBy, uniq } from "lodash";
import minimumPathLength from "./minimum-path-length";
import shortestPath from "./shortest-path";

type algorithms = "exhaustive" | "heuristic";
export default function spanningTree<T>(
  destGroups: Hex<T>[][],
  grid: Grid,
  maxAdditional,
  algorithm: algorithms,
  costOf: (hex: Hex<T>) => number
) {
  // Choose which algorithm to use.
  // By the way, the heuristic always gives the best solution if destGroups.length <= 3 (maybe even with 4?)
  // The breadthwidth algorithm always gives the best solution anyway but is slower
  if (algorithm === "exhaustive") {
    assert(false, "Exhaustive spanning tree algorithm needs to be updated, use heuristic instead");
    // return spanningTreeBreadthWidth(destGroups, grid, maxAdditional);
  } else {
    return spanningTreeWithHeuristic(destGroups, grid, maxAdditional, costOf);
  }
}

function spanningTreeWithHeuristic<T>(
  destGroups: Hex<T>[][],
  grid: Grid<Hex<T>>,
  maxAdditional = -1,
  costOf = (hex: Hex<T>) => 1
): { path: Hex[]; cost: number } | { minCost: number } {
  type DestGroup = Hex<T>[];

  const minCost = minimumPathLength(destGroups);
  if (maxAdditional > -1 && maxAdditional < minCost) {
    return { minCost };
  }

  const destHexes: Hex<T>[] = [].concat(...destGroups);
  const destHexesSet = new Set(destHexes);

  if (destGroups.length <= 1) {
    return { path: destHexes, cost: sumBy(destHexes, costOf) };
  }

  const destGroupsMap: Map<Hex<T>, DestGroup> = new Map();
  for (const group of destGroups) {
    for (const hex of group) {
      destGroupsMap.set(hex, group);
    }
  }

  const [minQ, maxQ] = [minBy(destHexes, "q").q, maxBy(destHexes, "q").q];
  const [minR, maxR] = [minBy(destHexes, "r").r, maxBy(destHexes, "r").r];
  const [minS, maxS] = [minBy(destHexes, "s").s, maxBy(destHexes, "s").s];

  const startingPoints: Array<Hex<T>> = [];
  if (destGroups.length > 2) {
    // We pick all the hexes that are in the middle of the federation buildings, and try to create a network from them
    startingPoints.push(
      ...[...grid.values()].filter(
        (hex) =>
          !destHexesSet.has(hex) &&
          inRange(hex.q, minQ + 1, maxQ) &&
          inRange(hex.r, minR + 1, maxR) &&
          inRange(hex.s, minS + 1, maxS)
      )
    );
  }
  for (const group of destGroups) {
    startingPoints.push(group[0]);
  }

  const groupAround = (hex: Hex<T>) => {
    if (destGroupsMap.has(hex)) {
      return destGroupsMap.get(hex);
    } else {
      // If it's an empty hex next to buildings, include those buildings
      return uniq([hex, ...grid.neighbours(hex).map((nb) => destGroupsMap.get(nb) ?? [])].flat(1));
    }
  };

  let minScore = maxAdditional === -1 ? grid.size + 1 : destHexes.length + maxAdditional + 1;
  let bestSolution: Hex<T>[];

  for (const startingPoint of startingPoints) {
    let hexes = groupAround(startingPoint);
    let cost: number;
    let toReach = difference(destHexes, hexes);

    do {
      const hexSet = new Set<Hex<T>>(hexes);
      const path = shortestPath<T>(hexes, toReach, grid, (hex) => (hexSet.has(hex) ? 0 : costOf(hex)));

      if (!path) {
        hexes = undefined;
        break;
      }

      hexes = uniq(hexes.concat(path.path.slice(1, -1), groupAround(path.path[path.path.length - 1])));
      cost = sumBy(hexes, costOf);
      toReach = difference(toReach, hexes);
    } while (cost < minScore && toReach.length > 0);

    if (hexes && cost < minScore) {
      minScore = cost;
      bestSolution = hexes;
    }
  }

  if (bestSolution) {
    return { path: bestSolution, cost: minScore };
  }

  return { minCost };
}

// No heuristic, but exhaustive
// TO REDO to take into accoutn new parameters (passing through an occupied planet, even if not in destGroup, is 0 cost)
// function spanningTreeBreadthWidth(destGroups: Hex[][], grid: Grid, maxAdditional = -1): Hex[] {
//   const destHexes: Hex[] = [].concat(...destGroups);
//   const destHexesSet = new Set(destHexes);

//   if (destGroups.length <= 1) {
//     return destHexes;
//   }

//   const destGroupsMap: Map<Hex, Hex[]> = new Map();
//   for (const group of destGroups) {
//     for (const hex of group) {
//       destGroupsMap.set(hex, group);
//     }
//   }

//   class HexGroup {
//     hexes: Hex[] = [];

//     constructor(hexes: Hex[] = []) {
//       this.hexes = sortBy(hexes, hex => hex.toString());
//     }

//     key(): string {
//       return this.hexes.map(h => h.toString()).join(',');
//     }

//     withAdditionalHexes(hexes: Hex[]): HexGroup {
//       return new HexGroup(uniq(this.hexes.concat(hexes)));
//     }

//     get winning(): boolean {
//       return this.hexes.filter(hex => destHexesSet.has(hex)).length === destHexesSet.size;
//     }
//   }

//   let minScore = maxAdditional === -1 ? grid.size + 1 : destHexes.length + maxAdditional + 1;
//   let bestSolution: Hex[];
//   const explored: Map<string, HexGroup> = new Map();

//   const groupAround = hex => {
//     if (destGroupsMap.has(hex)) {
//       return destGroupsMap.get(hex);
//     } else {
//       return [hex];
//     }
//   };

//   let toExplore: Map<string, HexGroup> = new Map();
//   let toExploreNext: Map<string, HexGroup> = new Map();

//   const startingGroup = new HexGroup(destGroups[0]);
//   toExplore.set(startingGroup.key(), startingGroup);

//   while (toExplore.size > 0) {
//     for (const hexGroup of toExplore.values()) {
//       if (!(hexGroup.hexes.length < minScore)) {
//         continue;
//       }

//       for (const hex of hexGroup.hexes) {
//         for (const neighbour of grid.neighbours(hex)) {
//           if (hexGroup.hexes.includes(neighbour)) {
//             continue;
//           }

//           const newHexGroup = hexGroup.withAdditionalHexes(groupAround(neighbour));
//           const key = newHexGroup.key();

//           if (explored.has(key)) {
//             continue;
//           }

//           explored.set(key, newHexGroup);

//           if (newHexGroup.hexes.length >= minScore) {
//             continue;
//           }

//           if (newHexGroup.winning) {
//             minScore = newHexGroup.hexes.length;
//             bestSolution = newHexGroup.hexes;
//           } else {
//             toExploreNext.set(key, newHexGroup);
//           }
//         }
//       }
//     }

//     toExplore = toExploreNext;
//     toExploreNext = new Map();
//   }

//   return bestSolution;
// }
