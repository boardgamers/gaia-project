/**
 * Type-safe replacements for the lodash functions used in the viewer.
 *
 * Lodash's collection typings collapse generic parameters in several of these
 * functions under the current TypeScript / @types/lodash combination (surfacing as
 * `Type 'unknown' cannot be used as an index type` and similar errors). These
 * implementations preserve the generic types and cover the subset of lodash that the
 * viewer actually uses.
 */

type PropertyKey = string | number | symbol;
type Iteratee<T, R> = ((item: T) => R) | keyof T;

function iteratee<T, R>(it: Iteratee<T, R>): (item: T) => R {
  return typeof it === "function" ? (it as (item: T) => R) : (item: T) => item[it as keyof T] as unknown as R;
}

function compare(a: number | string, b: number | string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** See lodash `sortBy`. Returns a new array; does not mutate the input. */
export function sortBy<T>(array: readonly T[], it?: Iteratee<T, number | string>): T[] {
  const key = it === undefined ? (item: T) => item as unknown as number | string : iteratee(it);
  return [...array].sort((a, b) => compare(key(a), key(b)));
}

/** See lodash `orderBy`. Only a single iteratee and a single direction are supported. */
export function orderBy<T>(
  array: readonly T[],
  it: Iteratee<T, number | string>,
  direction: "asc" | "desc" = "asc"
): T[] {
  const sorted = sortBy(array, it);
  return direction === "desc" ? sorted.reverse() : sorted;
}

/** See lodash `sum`. */
export function sum(array: readonly number[]): number {
  return array.reduce((acc, n) => acc + n, 0);
}

/** See lodash `sumBy`. */
export function sumBy<T>(array: readonly T[], it: Iteratee<T, number>): number {
  const key = iteratee(it);
  return array.reduce((acc, item) => acc + key(item), 0);
}

/** See lodash `max`. */
export function max(array: readonly number[]): number | undefined {
  return array.length === 0 ? undefined : Math.max(...array);
}

/** See lodash `minBy`. */
export function minBy<T>(array: readonly T[], it: Iteratee<T, number>): T | undefined {
  const key = iteratee(it);
  let best: T | undefined;
  let bestValue = Infinity;
  for (const item of array) {
    const value = key(item);
    if (value < bestValue) {
      bestValue = value;
      best = item;
    }
  }
  return best;
}

/** See lodash `uniq`. */
export function uniq<T>(array: readonly T[]): T[] {
  return [...new Set(array)];
}

/** See lodash `sortedUniq`. The input must already be sorted. */
export function sortedUniq<T>(array: readonly T[]): T[] {
  return array.filter((item, index) => index === 0 || item !== array[index - 1]);
}

/** See lodash `countBy`. */
export function countBy<T>(array: readonly T[], it: Iteratee<T, PropertyKey>): Record<string, number> {
  const key = iteratee(it);
  const counts = new Map<PropertyKey, number>();
  for (const item of array) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const result: Record<string, number> = {};
  for (const [k, count] of counts) {
    result[String(k)] = count;
  }
  return result;
}

/** See lodash `findLast`. */
export function findLast<T>(array: readonly T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) {
      return array[i];
    }
  }
  return undefined;
}

/** See lodash `findLastIndex`. */
export function findLastIndex<T>(array: readonly T[], predicate: (item: T) => boolean): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) {
      return i;
    }
  }
  return -1;
}

/** See lodash `range`. */
export function range(start: number, end?: number, step = 1): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  const result: number[] = [];
  for (let n = start; step > 0 ? n < end : n > end; n += step) {
    result.push(n);
  }
  return result;
}

/** See lodash `pick`. */
export function pick<T extends object, K extends keyof T>(object: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = object[key];
  }
  return result;
}

/** See lodash `memoize`. Only zero- and single-argument functions are supported. */
export function memoize<R>(fn: () => R): () => R;
export function memoize<A, R>(fn: (arg: A) => R, resolver?: (arg: A) => PropertyKey): (arg: A) => R;
export function memoize<A, R>(fn: (arg: A) => R, resolver?: (arg: A) => PropertyKey): (arg: A) => R {
  const cache = new Map<PropertyKey, R>();
  return (arg: A) => {
    const key = resolver ? resolver(arg) : (arg as unknown as PropertyKey);
    if (cache.has(key)) {
      return cache.get(key) as R;
    }
    const result = fn(arg);
    cache.set(key, result);
    return result;
  };
}
