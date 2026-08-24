import * as seedrandomNamespace from "seedrandom";

// Interop-proof import: depending on which tsconfig/bundler compiles this file (tsc CommonJS for
// the node engine, webpack harmony modules for the viewer lib), a CJS package's "default" lands in
// different places. Resolve it once, at runtime.
const seedrandom: (seed: string) => () => number = (seedrandomNamespace as any).default ?? (seedrandomNamespace as any);

/**
 * Vendored re-implementation of the `shuffle-seed` npm package (MIT), byte-for-byte compatible:
 * the permutation for a given (array, seed) is IDENTICAL to the original package's. That matters
 * because map generation, faction setup and the Lost Fleet terraforming row all derive from these
 * shuffles - changing the algorithm would silently regenerate different boards for the same seed
 * (breaking replays of existing games and every seed-pinned test fixture).
 *
 * Local so the engine has no CJS-only dependency with default-import interop hazards in browser
 * bundles, and one less package for the ESM migration.
 */

function seedify(seed: string | number): string | number {
  if (typeof seed === "number" || typeof seed === "string") {
    return seed;
  }
  // The original package coerced exotic seeds to numbers; the engine only ever passes strings,
  // but keep the fallback for exactness.
  return Number(
    String(seed)
      .split("")
      .map((x) => x.charCodeAt(0))
      .join("")
  );
}

function seedRand(func: () => number, min: number, max: number): number {
  return Math.floor(func() * (max - min + 1)) + min;
}

export function shuffle<T>(arr: T[], seed: string | number): T[] {
  if (!Array.isArray(arr)) {
    return null as unknown as T[];
  }
  const finalSeed = seedify(seed) || "none";

  const size = arr.length;
  const rng = seedrandom(finalSeed as string);
  const resp: T[] = [];
  const keys: number[] = [];

  for (let i = 0; i < size; i++) {
    keys.push(i);
  }
  for (let i = 0; i < size; i++) {
    const r = seedRand(rng, 0, keys.length - 1);
    const g = keys[r];
    keys.splice(r, 1);
    resp.push(arr[g]);
  }
  return resp;
}

export function unshuffle<T>(arr: T[], seed: string | number): T[] {
  if (!Array.isArray(arr)) {
    return null as unknown as T[];
  }
  const finalSeed = seedify(seed) || "none";

  const size = arr.length;
  const rng = seedrandom(finalSeed as string);
  const resp: T[] = [];
  const keys: number[] = [];

  for (let i = 0; i < size; i++) {
    resp.push(null as unknown as T);
    keys.push(i);
  }

  for (let i = 0; i < size; i++) {
    const r = seedRand(rng, 0, keys.length - 1);
    const g = keys[r];
    keys.splice(r, 1);
    resp[g] = arr[i];
  }

  return resp;
}

export default { shuffle, unshuffle };
