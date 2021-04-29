import { mergeWith } from "lodash";

function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

/** Like lodash.merge, but doesn't merge arrays */
export function merge(target, ...sources) {
  return mergeWith(target, ...sources, customizer);
}

/**
 * Returns all combinations of all sizes
 *
 * Order of combinations and order of elements within the combinations are not guaranteed
 *
 * @example `combinations([1, 2])` will return `[[], [1], [2], [1,2]]` in this order or another
 *
 */
export function combinations<T>(t: T[]): T[][] {
  if (t.length === 0) {
    return [[]];
  }
  return combinations(t.slice(1)).flatMap((value) => [value, value.concat(t[0])]);
}
