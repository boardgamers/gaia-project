/**
 * FUZZER_PLAN.md §2 — failure minimizer (greedy turn-prefix/segment removal + replay).
 *
 * Replay-based shrinking is sound because the engine is deterministic from seed + moves (§J3):
 * dropping a line and replaying the remainder either still reproduces the SAME failure signature
 * (keep the removal) or breaks replay/changes the failure (undo it). Two passes:
 * 1. Prefix shrink: binary-search the shortest leading prefix that still reproduces (cheap, and
 *    already sufficient for failures caused by the very last line itself).
 * 2. Segment shrink: greedily try dropping each remaining line (tail-to-head, since later lines
 *    are least likely to be a prerequisite for earlier ones) from what's left after step 1,
 *    keeping the removal only if the failure signature is unchanged.
 */
import Engine, { EngineOptions } from "../engine";
import { cloneOptions } from "./state";

export interface ReproFn {
  /** Replays `moves` from scratch; returns a stable failure signature, or null if it doesn't
   * reproduce (moves are invalid/incomplete, or the original failure no longer occurs). */
  (moves: string[]): string | null;
}

/** Builds a `ReproFn` that reproduces the exact tier-1 "constructor replay throws" / oracle-set
 * failure class this fuzzer's driver looks for, keyed off the target failure's oracle name. */
export function reproFnFor(options: EngineOptions, oracles: { name: string; check: (engine: Engine) => string[] }[]): ReproFn {
  return (moves: string[]) => {
    let engine: Engine;
    try {
      engine = new Engine([...moves], cloneOptions(options));
    } catch (err) {
      return `throw:${err.message}`;
    }
    for (const oracle of oracles) {
      const messages = oracle.check(engine);
      if (messages.length > 0) {
        return `${oracle.name}:${messages[0]}`;
      }
    }
    return null;
  };
}

export interface ShrinkResult {
  moves: string[];
  signature: string;
  originalLength: number;
}

export function shrink(moves: string[], repro: ReproFn): ShrinkResult | null {
  const originalSignature = repro(moves);
  if (originalSignature === null) {
    return null; // doesn't reproduce at all - nothing to shrink
  }

  // Pass 1: shortest reproducing prefix.
  let lo = 2; // keep at least the init line + 1 more
  let hi = moves.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const sig = repro(moves.slice(0, mid));
    if (sig === originalSignature) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  let current = moves.slice(0, lo);

  // Pass 2: greedily drop individual lines (excluding the init line at index 0), tail-to-head.
  for (let i = current.length - 1; i >= 1; i--) {
    const candidate = [...current.slice(0, i), ...current.slice(i + 1)];
    const sig = repro(candidate);
    if (sig === originalSignature) {
      current = candidate;
    }
  }

  return { moves: current, signature: originalSignature, originalLength: moves.length };
}
