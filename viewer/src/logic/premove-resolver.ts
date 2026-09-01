// Phase 3 (docs/lost-fleet/PREMOVE_PLAN.md §10.5) - the one shared decision function for "given a
// seat's queued premoves and the engine state at the instant it's genuinely their turn
// (Phase.RoundMove already confirmed by the caller), which move (if any) should be committed, and
// what happens to the queue afterward". Imported identically by host.ts's client fast-path and by
// resolve-automation/logic.ts's edge-function path, so online/offline resolution can never drift -
// this is the ONLY place either mode's branching logic is decided (mirrors how auto-decide.ts is the
// one shared leech-decision helper for both paths).
//
// Structural/engine-agnostic on purpose (no "@gaia-project/engine" import here), for the same reason
// resolve-automation/logic.ts's own EngineModule/EngineInstance types are structural: it lets each
// caller supply whatever Engine implementation it already has in hand (host.ts's real statically-
// imported Engine; the edge function's dynamically-bundled one) without this file taking on a build/
// bundling dependency of its own.

export type PremoveMode = "sequential" | "priority";

/** Exported so callers can distinguish this defensive case (shouldn't normally happen - queuing
 * already enforces completeness) from a genuine thrown-error failure without string-sniffing an
 * arbitrary engine error message. */
export const INCOMPLETE_TURN_REASON = "premove did not complete a turn";

export type QueuedPremove = { seq: number; move: string };

export type EngineLike = {
  playerToMove: number | undefined;
  phase: string;
  round: number;
  newTurn: boolean;
  players: unknown[];
  move(line: string): void;
  generateAvailableCommandsIfNeeded(): unknown;
};

export type PremoveResolution =
  | { outcome: "none" }
  | {
      outcome: "success";
      move: string;
      resultEngine: EngineLike;
      /** seq values to delete from the seat's queue now that this turn has been decided. */
      consumedSeqs: number[];
      /** Priority only: which rank fired (1-based) and how many were ranked, for the success toast
       * naming the rank when it wasn't rank 1 (§10.6). */
      rank?: number;
      totalRanks?: number;
    }
  | {
      outcome: "failed";
      reason: string;
      /** The move text to record in premove_failures (a single representative line even when
       * multiple rows are discarded together). */
      failedMove: string;
      consumedSeqs: number[];
    };

function attempt(
  cloneEngine: () => EngineLike,
  move: string
): { ok: true; engine: EngineLike } | { ok: false; threw: boolean; reason: string } {
  const clone = cloneEngine();
  try {
    clone.move(move);
    clone.generateAvailableCommandsIfNeeded();
  } catch (err) {
    return { ok: false, threw: true, reason: err instanceof Error ? err.message : String(err) };
  }
  if (!clone.newTurn) {
    return { ok: false, threw: false, reason: INCOMPLETE_TURN_REASON };
  }
  return { ok: true, engine: clone };
}

/**
 * `cloneEngine` must produce a FRESH disposable clone of the seat's real current engine state on
 * every call - Priority mode tries multiple candidates, each against the ORIGINAL committed state,
 * never against a previous candidate's mutation. A factory (rather than this file cloning directly)
 * lets each caller keep its own preferred cloning strategy (host.ts: `Engine.fromData(json)`; the
 * edge function: replaying the move log fresh) instead of this shared file taking a stance on it.
 */
export function resolvePremoveQueue(
  cloneEngine: () => EngineLike,
  seat: number,
  rows: QueuedPremove[],
  mode: PremoveMode
): PremoveResolution {
  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  if (ordered.length === 0) {
    return { outcome: "none" };
  }

  if (mode === "sequential") {
    const head = ordered[0];
    const result = attempt(cloneEngine, head.move);
    if (result.ok) {
      return { outcome: "success", move: head.move, resultEngine: result.engine, consumedSeqs: [head.seq] };
    }

    const rest = ordered.slice(1).map((r) => r.seq);
    // Explicit shape: control-flow narrowing of the result union is unreliable under the older
    // TS used by some compile paths (engine tsconfig via ts-node), so assert the failure member.
    const failure = result as { ok: false; threw: boolean; reason: string };
    if (failure.threw && rest.length > 0) {
      // A broken link invalidates the plan behind it (§10.5): cascade-discard the rest rather than
      // attempting them against state their own preview never accounted for.
      return {
        outcome: "failed",
        reason: `${failure.reason} — ${rest.length} more queued premove${
          rest.length > 1 ? "s" : ""
        } discarded, they depended on this one`,
        failedMove: head.move,
        consumedSeqs: [head.seq, ...rest],
      };
    }
    // Either a plain throw with nothing behind it, or the defensive "applied but didn't complete a
    // turn" case (shouldn't normally happen - queuing already enforces completeness) - Phase 1's
    // original behavior, no cascade needed since there's nothing after it or nothing to protect.
    return { outcome: "failed", reason: failure.reason, failedMove: head.move, consumedSeqs: [head.seq] };
  }

  // Priority: try ranks in ascending order against the SAME original state; first legal one wins.
  // An illegal rank is skipped silently - only "every rank illegal" is a reportable failure.
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i];
    const result = attempt(cloneEngine, row.move);
    if (result.ok) {
      return {
        outcome: "success",
        move: row.move,
        resultEngine: result.engine,
        consumedSeqs: ordered.map((r) => r.seq),
        rank: i + 1,
        totalRanks: ordered.length,
      };
    }
  }
  return {
    outcome: "failed",
    reason: `none of your ${ordered.length} ranked premoves were legal`,
    failedMove: ordered.map((r) => r.move).join(" / "),
    consumedSeqs: ordered.map((r) => r.seq),
  };
}
