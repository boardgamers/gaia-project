import * as _ from 'lodash';
import { Grid, Hex } from "hexagrid";
import shortestPath from './shortest-path';

export default function spanningTree(destGroups: Hex[][], grid: Grid, maxAdditional = -1): Hex[] {
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

  const startingPoints = [...grid.values()].filter(hex => !destHexesSet.has(hex) && _.inRange(hex.q, minQ+1, maxQ) && _.inRange(hex.r, minR+1, maxR) && _.inRange(hex.s, minS+1, maxS))
  for (const group of destGroups) {
    startingPoints.push(group[0]);
  }

  const groupAround = hex => {
    if (destGroupsMap.has(hex)) {
      return destGroupsMap.get(hex);
    } else {
      return [hex];
    }
  }

  let minScore = maxAdditional === -1 ? grid.size + 1 : destHexes.length + maxAdditional + 1;
  let bestSolution = undefined;

  for (const startingPoint of startingPoints) {
    let hexes = groupAround(startingPoint);
    let toReach = _.difference(destHexes, hexes);
    
    do {
      const path: Hex[] = shortestPath(hexes, toReach, grid);

      if (!path) {
        hexes = undefined;
        break;
      }

      hexes = _.uniq(hexes.concat(path.slice(1, -1), groupAround(path[path.length-1])));
      toReach = _.difference(toReach, groupAround(path[path.length-1]));
    } while (hexes.length < minScore && toReach.length > 0);

    if (hexes && hexes.length < minScore) {
      minScore = hexes.length;
      bestSolution = hexes;
    }
  }

  return bestSolution;
}