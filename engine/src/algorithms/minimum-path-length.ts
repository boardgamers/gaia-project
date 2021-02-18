import { Hex, CubeCoordinates } from "hexagrid";
import { flatten } from "lodash";

/**
 * Heuristic to give the minimum length needed to connect the two furthest groups from @param groups
 *
 * Could get a higher minimum length if we used `shortestPath`, but this is a lot faster and allows
 * to already exlude some combinations
 */
export default function minimumPathLength<T>(groups: Array<Hex<T>[]>): number {
  if (groups.length === 1) {
    return 0;
  }

  type DestGroup = Hex<T>[];
  const shortestPaths = new Map<DestGroup, Map<DestGroup, number>>();

  for (const group of groups) {
    shortestPaths.set(group, new Map());
  }

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const [group1, group2] = [groups[i], groups[j]];

      const shortest = Math.min(...flatten(group1.map((x) => group2.map((y) => CubeCoordinates.distance(x, y))))) - 1;

      shortestPaths.get(group1).set(group2, shortest);
    }
  }

  // This part can be optimized
  let modified: boolean;
  do {
    modified = false;

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        for (let k = j + 1; k < groups.length; k++) {
          const [group1, group2, group3] = [groups[i], groups[j], groups[k]];

          if (
            shortestPaths.get(group1).get(group2) + shortestPaths.get(group2).get(group3) <
            shortestPaths.get(group1).get(group3)
          ) {
            shortestPaths
              .get(group1)
              .set(group3, shortestPaths.get(group1).get(group2) + shortestPaths.get(group2).get(group3));
            modified = true;
          }

          if (
            shortestPaths.get(group1).get(group2) + shortestPaths.get(group1).get(group3) <
            shortestPaths.get(group2).get(group3)
          ) {
            shortestPaths
              .get(group2)
              .set(group3, shortestPaths.get(group1).get(group2) + shortestPaths.get(group1).get(group3));
            modified = true;
          }

          if (
            shortestPaths.get(group1).get(group3) + shortestPaths.get(group2).get(group3) <
            shortestPaths.get(group1).get(group3)
          ) {
            shortestPaths
              .get(group1)
              .set(group2, shortestPaths.get(group1).get(group3) + shortestPaths.get(group2).get(group3));
            modified = true;
          }
        }
      }
    }
  } while (modified);

  return Math.max(...flatten([...shortestPaths.values()].map((v) => [...v.values()])));
}
