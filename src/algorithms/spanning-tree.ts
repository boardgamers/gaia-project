import * as _ from 'lodash';
import { Grid, Hex } from "hexagrid";
import shortestPath from './shortest-path';

type algorithms = "exhaustive" | "heuristic";
export default function spanningTree(destGroups: Hex[][], grid: Grid, maxAdditional = -1, algorithm: algorithms = "heuristic") {
  // Choose which algorithm to use.
  // By the way, the heuristic always gives the best solution if destGroups.length <= 3 (maybe even with 4?)
  // The breadthwidth algorithm always gives the best solution anyway but is slower
  if (algorithm === "exhaustive") {
    return spanningTreeBreadthWidth(destGroups, grid, maxAdditional);
  } else {
    return spanningTreeWithHeuristic(destGroups, grid, maxAdditional);
  }
}

function spanningTreeWithHeuristic(destGroups: Hex[][], grid: Grid, maxAdditional = -1): Hex[] {
  const destHexes: Hex[] = [].concat(...destGroups);
  const destHexesSet = new Set(destHexes);

  if (destGroups.length <= 1) {
    return destHexes;
  }

  const destGroupsMap: Map<Hex, Hex[]> = new Map();
  for (const group of destGroups) {
    for (const hex of group) {
      destGroupsMap.set(hex, group);
    }
  }

  const [minQ, maxQ] = [_.minBy(destHexes, 'q').q, _.maxBy(destHexes, 'q').q];
  const [minR, maxR] = [_.minBy(destHexes, 'r').r, _.maxBy(destHexes, 'r').r];
  const [minS, maxS] = [_.minBy(destHexes, 's').s, _.maxBy(destHexes, 's').s];

  const startingPoints: Array<Hex<any>> = [];
  if (destGroups.length > 2) {
    // We pick all the hexes that are in the middle of the federation buildings, and try to create a network from them
    startingPoints.push(...[...grid.values()].filter(hex => !destHexesSet.has(hex) && _.inRange(hex.q, minQ + 1, maxQ) && _.inRange(hex.r, minR + 1, maxR) && _.inRange(hex.s, minS + 1, maxS)));
  }
  for (const group of destGroups) {
    startingPoints.push(group[0]);
  }

  const groupAround = hex => {
    if (destGroupsMap.has(hex)) {
      return destGroupsMap.get(hex);
    } else {
      return [hex];
    }
  };

  let minScore = maxAdditional === -1 ? grid.size + 1 : destHexes.length + maxAdditional + 1;
  let bestSolution;

  for (const startingPoint of startingPoints) {
    let hexes = groupAround(startingPoint);
    let toReach = _.difference(destHexes, hexes);

    do {
      const path: Hex[] = shortestPath(hexes, toReach, grid);

      if (!path) {
        hexes = undefined;
        break;
      }

      hexes = _.uniq(hexes.concat(path.slice(1, -1), groupAround(path[path.length - 1])));
      toReach = _.difference(toReach, groupAround(path[path.length - 1]));
    } while (hexes.length < minScore && toReach.length > 0);

    if (hexes && hexes.length < minScore) {
      minScore = hexes.length;
      bestSolution = hexes;
    }
  }

  return bestSolution;
}

// No heuristic, but exhaustive
function spanningTreeBreadthWidth(destGroups: Hex[][], grid: Grid, maxAdditional = -1): Hex[] {
  const destHexes: Hex[] = [].concat(...destGroups);
  const destHexesSet = new Set(destHexes);

  if (destGroups.length <= 1) {
    return destHexes;
  }

  const destGroupsMap: Map<Hex, Hex[]> = new Map();
  for (const group of destGroups) {
    for (const hex of group) {
      destGroupsMap.set(hex, group);
    }
  }

  class HexGroup {
    hexes: Hex[] = [];

    constructor(hexes: Hex[] = []) {
      this.hexes = _.sortBy(hexes, hex => hex.toString());
    }

    key(): string {
      return this.hexes.map(h => h.toString()).join(',');
    }

    withAdditionalHexes(hexes: Hex[]): HexGroup {
      return new HexGroup(_.uniq(this.hexes.concat(hexes)));
    }

    get winning(): boolean {
      return this.hexes.filter(hex => destHexesSet.has(hex)).length === destHexesSet.size;
    }
  }

  let minScore = maxAdditional === -1 ? grid.size + 1 : destHexes.length + maxAdditional + 1;
  let bestSolution: Hex[];
  const explored: Map<string, HexGroup> = new Map();

  const groupAround = hex => {
    if (destGroupsMap.has(hex)) {
      return destGroupsMap.get(hex);
    } else {
      return [hex];
    }
  };

  let toExplore: Map<string, HexGroup> = new Map();
  let toExploreNext: Map<string, HexGroup> = new Map();

  const startingGroup = new HexGroup(destGroups[0]);
  toExplore.set(startingGroup.key(), startingGroup);

  while (toExplore.size > 0) {
    for (const hexGroup of toExplore.values()) {
      if (!(hexGroup.hexes.length < minScore)) {
        continue;
      }

      for (const hex of hexGroup.hexes) {
        for (const neighbour of grid.neighbours(hex)) {
          if (hexGroup.hexes.includes(neighbour)) {
            continue;
          }

          const newHexGroup = hexGroup.withAdditionalHexes(groupAround(neighbour));
          const key = newHexGroup.key();

          if (explored.has(key)) {
            continue;
          }

          explored.set(key, newHexGroup);

          if (newHexGroup.hexes.length >= minScore) {
            continue;
          }

          if (newHexGroup.winning) {
            minScore = newHexGroup.hexes.length;
            bestSolution = newHexGroup.hexes;
          } else {
            toExploreNext.set(key, newHexGroup);
          }
        }
      }
    }

    toExplore = toExploreNext;
    toExploreNext = new Map();
  }

  return bestSolution;
}
