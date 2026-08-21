// Pure decision logic for the resolve-automation Edge Function (PREMOVE_PLAN.md §4c), separated
// from index.ts's Deno.serve/service-role-client plumbing so it can be exercised by a plain test
// (no network, no Deno-specific globals) with a fake backend - mirrors how viewer/src/hosted/host.ts
// separates HostedGameHost's pure logic from its injected HostedBackend.
//
// Resolves exactly ONE committed turn per invocation, then returns - the commit's own current_seat
// change re-fires the trigger for the next seat/decision (mirrors the client's own recursion via
// repeated trigger firings, see host.ts's resolveAutoDecisions/applyAndCommit chain).
//
// Phase 2 (docs/lost-fleet/PREMOVE_PLAN.md's phasing) added the Phase.RoundLeech/auto-charge
// branch below. Any OTHER non-RoundMove phase (setup, income, gaia, scoring, endgame) is still a
// no-op: the premove stays queued untouched, waiting for its moment.
//
// Phase 3 (§10.5) factored the RoundMove branch's own mode-branching (Sequential vs Priority) out
// into resolvePremoveQueue, a shared helper also imported by host.ts's client fast-path, so online
// and offline resolution can never drift - this file's own job is now just: fetch the seat's queue,
// hand it to the resolver, and translate its decision into commits/deletes/failure rows.
//
// Premove cancel triggers (migration 20260815090000) added a check that runs BEFORE the queue is
// resolved, in identical order to host.ts's own resolveAutoDecisions - both import the same
// matchCancelTriggers so online/offline can never disagree about whether a queue survived.

import {
  CancelTriggerRow as MatcherCancelTriggerRow,
  matchCancelTriggers,
  MapLike,
  SeatedMove,
} from "../../../viewer/src/logic/premove-cancel-trigger.ts";
import { INCOMPLETE_TURN_REASON, resolvePremoveQueue } from "../../../viewer/src/logic/premove-resolver.ts";

export type GameRow = {
  id: string;
  seed: string;
  player_count: number;
  options: Record<string, unknown> | null;
  move_count: number;
};

export type MoveRow = { seq: number; seat: number; move: string };
export type PremoveMode = "sequential" | "priority";
export type PremoveRow = { seq: number; move: string; mode: PremoveMode };

// Premove cancel triggers - DB row shape (snake_case, mirrors the migration), converted to the
// matcher module's own camelCase CancelTriggerRow via toMatcherTrigger below (same split host.ts's
// own toMatcherTriggers uses).
export type CancelTriggerDbRow = {
  seq: number;
  kind: "move" | "leech";
  watched_seat: number;
  move: string;
  atoms: string[];
  config: Record<string, unknown>;
  match: "any" | "all";
  armed_from_move_count: number;
};

function toMatcherTrigger(row: CancelTriggerDbRow): MatcherCancelTriggerRow {
  return {
    seq: row.seq,
    kind: row.kind,
    watchedSeat: row.watched_seat,
    move: row.move,
    atoms: row.atoms,
    config: row.config as unknown as MatcherCancelTriggerRow["config"],
    match: row.match,
    armedFromMoveCount: row.armed_from_move_count,
  };
}

/** Plain-language text for the premove_failures.reason of a fired cancel trigger - a self-contained
 * cousin of host.ts's own describeCancelTriggerReason (duplicated rather than imported: this file
 * cannot pull in anything that drags a static "@gaia-project/engine" dependency into the edge
 * function's bundle, which viewer/src/data/factions.ts and .../research.ts both do). Cosmetic only -
 * never used for matching, so a simpler capitalization here costs nothing functionally. */
function capitalize(word: string): string {
  return word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function describeMatchedAtom(atom: string): string {
  const [command, ...rest] = atom.split(":");
  switch (command) {
    case "build":
      return `built ${rest[0] ?? "something"} at ${rest[1] ?? "a hex"}`;
    case "up":
      return `advanced ${rest[0] ?? "a track"}`;
    case "tech":
      return `took the tech tile at ${rest[0] ?? "a track"}`;
    case "action":
      return `took board action ${rest[0] ?? ""}`.trim();
    case "special":
      return "used a special action";
    case "pass":
      return `passed, taking booster ${rest[0] ?? ""}`.trim();
    case "federation":
      return "formed a federation";
    case "charge":
      return `charged ${rest[0] ?? "power"}`;
    case "decline":
      return `declined ${rest[0] ?? "power"}`;
    default:
      return `played ${atom}`;
  }
}

function describeCancelTriggerReason(
  trigger: MatcherCancelTriggerRow,
  atom: string,
  watchedFaction: string | undefined
): string {
  const description = describeMatchedAtom(atom);
  if (trigger.kind === "leech") {
    return `you ${description}`;
  }
  return `${watchedFaction ? capitalize(watchedFaction) : "Opponent"} ${description}`;
}

export type PlayerUpdate = { seat: number; faction: string; score: number };

export type CommitAutomatedTurnArgs = {
  gameId: string;
  seq: number;
  seat: number;
  move: string;
  nextSeat: number | null;
  finished: boolean;
  currentRound: number;
  playerUpdates: PlayerUpdate[];
};

// The slice of the bundled engine module this logic needs - kept minimal and structural so this
// file has no direct dependency on the engine bundle's own types.
export type EngineModule = {
  Engine: new (moves: string[], options?: Record<string, unknown>) => EngineInstance;
  Phase: { RoundMove: string; RoundLeech: string; EndGame: string };
  parseAutoChargePreference: (pref: string) => unknown;
  parseAutoChargeMaxPassedRoundLeech: (pref: string) => number;
};

export type EngineInstance = {
  playerToMove: number | undefined;
  phase: string;
  round: number;
  newTurn: boolean;
  moveHistory: string[];
  players: { player: number; faction?: string; data: { victoryPoints: number } }[];
  map: MapLike;
  generateAvailableCommandsIfNeeded(): unknown;
  move(line: string): void;
  player(seat: number): { settings: { autoChargePower: unknown; autoChargeMaxPassedRoundLeech?: number } };
  autoMove(): boolean;
};

export type Backend = {
  fetchGame(gameId: string): Promise<GameRow>;
  fetchMoves(gameId: string): Promise<MoveRow[]>;
  /** All of the seat's queued rows, any order (the resolver sorts by seq itself). Empty when
   * nothing is queued. */
  fetchPremoveQueue(gameId: string, seat: number): Promise<PremoveRow[]>;
  deletePremove(gameId: string, seat: number, seq: number): Promise<void>;
  insertPremoveFailure(
    gameId: string,
    seat: number,
    move: string,
    reason: string,
    kind?: "failure" | "cancelled"
  ): Promise<void>;
  commitAutomatedTurn(args: CommitAutomatedTurnArgs): Promise<void>;
  fetchAutoCharge(gameId: string, seat: number): Promise<string>;
  /** Every cancel trigger armed by this seat (the owner). Empty when none are armed. */
  fetchCancelTriggers(gameId: string, seat: number): Promise<CancelTriggerDbRow[]>;
  /** Deletes every one of the seat's cancel trigger rows, returning how many were actually deleted -
   * the race arbiter (see migration 20260815090000's own doc comment): 0 means the client fast-path
   * (or a duplicate trigger delivery) already won this exact match and this call has nothing to do. */
  deleteCancelTriggers(gameId: string, seat: number): Promise<number>;
  /** Re-invokes `notify` with {game_id, type: "update"} after the queue's premove rows are gone, so
   * the "your turn" push - suppressed while they existed - fires now instead of being lost (§7).
   * Best-effort: a failure here costs a notification, never the cancellation itself. */
  notifyGameUpdate(gameId: string): Promise<void>;
};

export type Result =
  | { outcome: "stale-trigger" }
  | { outcome: "no-premove-queued" }
  | { outcome: "wrong-phase"; phase: string }
  | { outcome: "premove-failed"; reason: string }
  | { outcome: "premove-incomplete-turn" }
  | { outcome: "committed"; seq: number; rank?: number; totalRanks?: number }
  | { outcome: "premoves-cancelled"; reason: string }
  | { outcome: "cancel-trigger-already-handled" }
  | { outcome: "seq-conflict" }
  | { outcome: "replay-failed"; reason: string }
  | { outcome: "leech-ask" }
  | { outcome: "leech-auto-decide-produced-nothing" };

const SEQ_CONFLICT_PREFIX = "seq_conflict";

function isSeqConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes(SEQ_CONFLICT_PREFIX);
}

function engineOptions(game: GameRow): Record<string, unknown> {
  const options = JSON.parse(JSON.stringify(game.options ?? {}));
  delete (options as Record<string, unknown>).map;
  return options;
}

function playerUpdatesOf(engine: EngineInstance): PlayerUpdate[] {
  return engine.players
    .filter((pl) => !!pl.faction)
    .map((pl) => ({ seat: pl.player, faction: pl.faction!, score: pl.data.victoryPoints }));
}

export async function resolveOneAutomatedTurn(
  engineModule: EngineModule,
  backend: Backend,
  gameId: string,
  seat: number
): Promise<Result> {
  const { Engine, Phase, parseAutoChargePreference } = engineModule;

  const [game, moves] = await Promise.all([backend.fetchGame(gameId), backend.fetchMoves(gameId)]);
  const ordered = [...moves].sort((a, b) => a.seq - b.seq);
  const initLine = `init ${game.player_count} ${game.seed}`;

  let engine: EngineInstance;
  try {
    engine = new Engine([initLine, ...ordered.map((m) => m.move)], engineOptions(game));
    engine.generateAvailableCommandsIfNeeded();
  } catch (err) {
    return { outcome: "replay-failed", reason: err instanceof Error ? err.message : String(err) };
  }

  // Stale-trigger guard: the game moved on since this trigger fired.
  if (engine.playerToMove !== seat) {
    return { outcome: "stale-trigger" };
  }

  if (engine.phase === Phase.RoundLeech) {
    return resolveLeech(engineModule, backend, gameId, seat, game, ordered);
  }

  if (engine.phase !== Phase.RoundMove) {
    // setup/income/gaia/scoring/endgame: no-op. The queued premove (if any) is left untouched;
    // it's still there waiting the next time this seat's turn genuinely arrives in Phase.RoundMove.
    return { outcome: "wrong-phase", phase: engine.phase };
  }

  const queue = await backend.fetchPremoveQueue(gameId, seat);
  if (queue.length === 0) {
    return { outcome: "no-premove-queued" };
  }

  // Cancel triggers (same ordering as host.ts's resolveAutoDecisions: before resolving the queue,
  // gated on a non-empty queue - a match with nothing queued has no effect to apply).
  const triggers = await backend.fetchCancelTriggers(gameId, seat);
  if (triggers.length > 0) {
    const seatedMoves: SeatedMove[] = ordered.map((m) => ({ seq: m.seq, seat: m.seat, move: m.move }));
    const match = matchCancelTriggers(triggers.map(toMatcherTrigger), seatedMoves, engine.map);
    if (match) {
      const deleted = await backend.deleteCancelTriggers(gameId, seat);
      if (deleted === 0) {
        // Someone else (the client fast-path, or a duplicate trigger delivery) already won this
        // exact match - see deleteCancelTriggers' own doc comment. Nothing further to do.
        return { outcome: "cancel-trigger-already-handled" };
      }
      for (const row of queue) {
        await backend.deletePremove(gameId, seat, row.seq);
      }
      const watchedFaction = engine.players.find((pl) => pl.player === match.trigger.watchedSeat)?.faction;
      const reason = describeCancelTriggerReason(match.trigger, match.atom, watchedFaction);
      await backend.insertPremoveFailure(gameId, seat, "", reason, "cancelled");
      // The premove rows are gone now, so notify's own suppression check (which reads the premoves
      // table) passes and the ordinary "your turn" push goes out - the immediate push that would
      // otherwise have been lost (§7). Best-effort - see notifyGameUpdate's own doc comment.
      try {
        await backend.notifyGameUpdate(gameId);
      } catch {
        // non-critical
      }
      return { outcome: "premoves-cancelled", reason };
    }
  }

  const mode = queue[0].mode;

  const resolution = resolvePremoveQueue(
    () => {
      const clone = new Engine([initLine, ...ordered.map((m) => m.move)], engineOptions(game));
      clone.generateAvailableCommandsIfNeeded();
      return clone;
    },
    seat,
    queue,
    mode
  );

  if (resolution.outcome === "none") {
    return { outcome: "no-premove-queued" };
  }

  if (resolution.outcome === "failed") {
    for (const seq of resolution.consumedSeqs) {
      await backend.deletePremove(gameId, seat, seq);
    }
    await backend.insertPremoveFailure(gameId, seat, resolution.failedMove, resolution.reason);
    return resolution.reason === INCOMPLETE_TURN_REASON
      ? { outcome: "premove-incomplete-turn" }
      : { outcome: "premove-failed", reason: resolution.reason };
  }

  // resolution.outcome === "success"
  const clone = resolution.resultEngine as unknown as EngineInstance;
  const finished = clone.phase === Phase.EndGame;
  const commitArgs: CommitAutomatedTurnArgs = {
    gameId,
    seq: ordered.length + 1,
    seat,
    move: resolution.move,
    nextSeat: finished ? null : (clone.playerToMove as number),
    finished,
    currentRound: clone.round,
    playerUpdates: playerUpdatesOf(clone),
  };

  try {
    await backend.commitAutomatedTurn(commitArgs);
  } catch (err) {
    if (isSeqConflict(err)) {
      // Someone else already handled this (the player's own fast-path, or a duplicate trigger
      // delivery) - silent no-op, do NOT write a failure row and do NOT delete any premove rows
      // (the winning path already consumed them - finding #6, unchanged by Phase 3).
      return { outcome: "seq-conflict" };
    }
    throw err;
  }

  for (const seq of resolution.consumedSeqs) {
    await backend.deletePremove(gameId, seat, seq);
  }
  return { outcome: "committed", seq: commitArgs.seq, rank: resolution.rank, totalRanks: resolution.totalRanks };
}

/**
 * Phase 2: a pending charge/leech decision (Phase.RoundLeech) for `seat`. Reads that seat's stored
 * auto_charge preference and resolves exactly ONE auto-charge turn via a single `engine.autoMove()`
 * call (never loop it here: looping and committing a multi-turn ". "-joined string as one `moves`
 * row would break the one-row-per-turn / seq invariant - see PREMOVE_PLAN.md's finding #8 in the
 * RoundLeech section of §4c). If more leech remains for this same seat afterward, the commit's own
 * current_seat "change" (it may stay the same seat - see host.ts's tempCurrentPlayer handling)
 * re-fires the trigger for another invocation.
 *
 * We run autoMove even for the 'ask' (default) preference: the engine still auto-resolves its
 * always-safe deterministic decisions there - chiefly a passed player's pointless charge in the
 * last round, which otherwise sat as a pending turn nobody was around to clear. A genuine leech an
 * 'ask' user must decide by hand produces nothing here and stays a 'leech-ask' no-op.
 */
async function resolveLeech(
  engineModule: EngineModule,
  backend: Backend,
  gameId: string,
  seat: number,
  game: GameRow,
  ordered: MoveRow[]
): Promise<Result> {
  const { Engine, Phase, parseAutoChargeMaxPassedRoundLeech, parseAutoChargePreference } = engineModule;

  const pref = await backend.fetchAutoCharge(gameId, seat);
  const autoChargePower = parseAutoChargePreference(pref);

  const initLine = `init ${game.player_count} ${game.seed}`;
  const clone = new Engine([initLine, ...ordered.map((m) => m.move)], engineOptions(game));
  clone.generateAvailableCommandsIfNeeded();
  clone.player(seat).settings.autoChargePower = autoChargePower;
  clone.player(seat).settings.autoChargeMaxPassedRoundLeech = parseAutoChargeMaxPassedRoundLeech(pref);

  const produced = clone.autoMove();
  if (!produced || !clone.newTurn) {
    // Nothing auto-decided. For an 'ask' user that's the normal "this is a real leech, wait for a
    // human" case; for an opted-in user it's the defensive "autoMove only returns true after a full
    // turn, so this shouldn't happen" case. Either way, leave the game state untouched.
    return autoChargePower === "ask" ? { outcome: "leech-ask" } : { outcome: "leech-auto-decide-produced-nothing" };
  }

  const move = clone.moveHistory[clone.moveHistory.length - 1];
  const finished = clone.phase === Phase.EndGame;
  const commitArgs: CommitAutomatedTurnArgs = {
    gameId,
    seq: ordered.length + 1,
    seat,
    move,
    nextSeat: finished ? null : (clone.playerToMove as number),
    finished,
    currentRound: clone.round,
    playerUpdates: playerUpdatesOf(clone),
  };

  try {
    await backend.commitAutomatedTurn(commitArgs);
  } catch (err) {
    if (isSeqConflict(err)) {
      return { outcome: "seq-conflict" };
    }
    throw err;
  }

  return { outcome: "committed", seq: commitArgs.seq };
}
