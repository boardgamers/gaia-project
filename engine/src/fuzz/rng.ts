/**
 * Tiny seeded PRNG for the fuzzer (FUZZER_PLAN.md §7: "Use a tiny seeded PRNG (e.g. mulberry32) — no deps").
 *
 * Deliberately NOT the engine's own seedrandom: the fuzzer's randomness (which command to pick)
 * must be independent of the engine's randomness (board setup from the game seed), so that the
 * same game seed can be explored with different play-outs and vice versa.
 */

/** FNV-1a-style string hash to derive a 32-bit seed from a seed string. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = () => number;

/** mulberry32: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromString(seed: string): Rng {
  return mulberry32(hashString(seed));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Weighted pick; entries with weight <= 0 are excluded. */
export function pickWeighted<T>(rng: Rng, entries: ReadonlyArray<[T, number]>): T | null {
  const usable = entries.filter(([, w]) => w > 0);
  const total = usable.reduce((acc, [, w]) => acc + w, 0);
  if (total <= 0) {
    return null;
  }
  let roll = rng() * total;
  for (const [item, weight] of usable) {
    roll -= weight;
    if (roll <= 0) {
      return item;
    }
  }
  return usable[usable.length - 1][0];
}
