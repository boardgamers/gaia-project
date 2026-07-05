import Engine, { Phase } from "@gaia-project/engine";
import { AutoCharge } from "@gaia-project/engine/src/player";
import { autoDecideChargePower } from "../logic/auto-decide";
import { PremoveResolution, resolvePremoveQueue } from "../logic/premove-resolver";
import {
  CommitTurnArgs,
  GameRow,
  HostedBackend,
  HostedCallbacks,
  MoveRow,
  PlayerRow,
  PlayerUpdate,
  PremoveFailureRow,
  PremoveMode,
  PremoveRow,
} from "./types";

const SEQ_CONFLICT_PREFIX = "seq_conflict";

function isSeqConflict(err: unknown): boolean {
  return errorMessage(err).includes(SEQ_CONFLICT_PREFIX);
}

/** A move line is "<player> <command> <args...>", possibly several joined by ". " - true if any of
 * them is a pass (§8/§10.7: a manual pass always clears the seat's queue, regardless of mode). */
function isPassMove(move: string): boolean {
  return move
    .split(". ")
    .some((part) => part.trim().split(/\s+/)[1] === "pass");
}

/**
 * "Auto leech" (see logic/auto-decide.ts) - unlike self-contained's hot-seat mode, hosted play has
 * real per-user seats, so this must never auto-decide on behalf of a seat the local user doesn't
 * hold (`isMySeat`) even if their own preference happens to be enabled. `getAutoChargePower` is a
 * live getter (not a snapshotted value) so a mid-game preference change takes effect on the very
 * next state update, not just future games.
 */
export type AutoDecideConfig = {
  isMySeat: (seat: number) => boolean;
  getAutoChargePower: () => AutoCharge;
};

const noAutoDecide: AutoDecideConfig = { isMySeat: () => false, getAutoChargePower: () => "ask" };

export function initMoveLine(game: GameRow): string {
  return `init ${game.player_count} ${game.seed}`;
}

/**
 * Engine-safe copy of the stored game options. The engine writes the
 * generated map back into the options object it is given, and `init` refuses
 * a pre-set map together with lostFleet — so a stored map (from rows written
 * before Lobby.vue probed on a copy) must be dropped. Always safe: the map
 * regenerates deterministically from the stored seed.
 */
export function engineOptions(game: GameRow): Record<string, unknown> {
  // Deep clone: the Engine mutates the options object it's given (stamps the
  // generated map + factionVariantVersion into it), so the stored row must
  // never be handed to it directly. Also strip any already-stored `map` —
  // a legacy row written before the create-game probe stopped leaking its
  // mutation — since init rejects a preset map combined with lostFleet.
  const options = JSON.parse(JSON.stringify(game.options ?? {}));
  delete options.map;
  return options;
}

/**
 * Which seat to lock the local UI to (the launcher's "player" event):
 * - `null` = no lock (hot-seat) when the user owns every seat (test games) —
 *   or none (RLS keeps strangers out entirely, and commit_turn re-checks
 *   seat ownership server-side, so an unlocked UI can never commit).
 * - Otherwise the user's seat that must act now, falling back to their first
 *   seat while an opponent (or an unowned seat) is on turn. Driven by
 *   `playerToMove`, so leech interrupts unlock the right seat (§J2).
 */
export function seatToLock(mySeats: number[], playerCount: number, playerToMove: number | undefined): number | null {
  if (mySeats.length === 0 || mySeats.length >= playerCount) {
    return null;
  }
  return playerToMove !== undefined && mySeats.includes(playerToMove) ? playerToMove : mySeats[0];
}

/**
 * Cached lobby-list display data (see 0009_lobby_round_faction_score_cache.sql) - a seat's faction
 * isn't chosen yet during setup, so it's simply omitted until it is (the lobby row falls back to
 * whatever it cached from a previous commit, or nothing yet for a brand new game).
 */
export function playerUpdates(engine: Engine): PlayerUpdate[] {
  return engine.players
    .filter((pl) => !!pl.faction)
    .map((pl) => ({ seat: pl.player, faction: pl.faction, score: pl.data.victoryPoints }));
}

/**
 * The Supabase-backed counterpart of self-contained.ts's harness: holds the
 * authoritative local engine (replayed from the stored move log), renders
 * partial moves locally, and persists a turn line only once the engine says
 * the turn completed (`copy.newTurn`) — the §J1/§A2 commitment rule.
 *
 * Pure logic: the backend and the state sink are injected, so this is fully
 * testable without supabase or a DOM (see host.spec.ts).
 */
export class HostedGameHost {
  engine: Engine;
  game: GameRow;
  players: PlayerRow[] = [];
  premoves: PremoveRow[] = [];
  premoveFailures: PremoveFailureRow[] = [];

  // Serializes submit/remote/resync so an in-flight commit can't interleave
  // with a realtime apply on the same engine.
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly backend: HostedBackend,
    private readonly gameId: string,
    private readonly callbacks: HostedCallbacks,
    private readonly autoDecide: AutoDecideConfig = noAutoDecide
  ) {}

  /** Committed turns == engine.moveHistory minus the init line at index 0. */
  get committedMoveCount(): number {
    return this.engine ? this.engine.moveHistory.length - 1 : 0;
  }

  mySeats(userId: string | null, email: string | null): number[] {
    const lowered = (email ?? "").toLowerCase();
    return this.players
      .filter((p) => (p.user_id !== null && p.user_id === userId) || (lowered !== "" && p.invited_email === lowered))
      .map((p) => p.seat);
  }

  load(): Promise<void> {
    return this.enqueue(async () => {
      const [game, players, moves] = await Promise.all([
        this.backend.fetchGame(this.gameId),
        this.backend.fetchPlayers(this.gameId),
        this.backend.fetchMoves(this.gameId),
      ]);
      this.game = game;
      this.players = players;
      this.engine = this.buildEngine(game, moves);
      this.emitState(this.engine);
      await this.refreshPremoveState();
      await this.resolveAutoDecisions();
    });
  }

  /**
   * Premove (PREMOVE_PLAN.md §4a) - `p_seat` is explicit (not inferred) so a multi-seat owner is
   * never ambiguous. Queuing/cancelling doesn't touch the engine at all (the client only offers the
   * button after building a legal turn against a preview clone - see Engine.previewAvailableCommandsFor
   * - so there's nothing to apply locally); just refreshes the cached list for display.
   */
  queuePremove(seat: number, move: string, mode: PremoveMode = "sequential"): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.queuePremove(this.gameId, seat, move, mode);
      await this.refreshPremoveState();
    });
  }

  cancelPremove(seat: number, seq: number): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.cancelPremove(this.gameId, seat, seq);
      await this.refreshPremoveState();
    });
  }

  /** Phase 3 (§10.4) - clears a seat's whole queue: the mode-toggle confirm, or the user just
   * wanting to start over instead of cancelling entries one at a time. */
  cancelAllPremoves(seat: number): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.cancelAllPremoves(this.gameId, seat);
      await this.refreshPremoveState();
    });
  }

  /** Phase 3 (§10.4), priority mode only - the RPC itself rejects a sequential queue. */
  reorderPremove(seat: number, seq: number, direction: "up" | "down"): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.reorderPremove(this.gameId, seat, seq, direction);
      await this.refreshPremoveState();
    });
  }

  markPremoveFailureRead(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.markPremoveFailureRead(id);
      await this.refreshPremoveState();
    });
  }

  /**
   * Phase 2 (offline auto-leech) - persists the local auto-charge preference for `seat` so
   * resolve-automation can honor it while this session isn't around to run the client-side
   * version itself. Best-effort: a failure here shouldn't block or alarm about ordinary gameplay,
   * since the online auto-leech path (`resolveAutoDecisions` above) keeps working regardless.
   */
  async setAutoCharge(seat: number, pref: string): Promise<void> {
    try {
      await this.backend.setAutoCharge(this.gameId, seat, pref);
    } catch (err) {
      this.callbacks.onError?.(`Could not save your auto-charge preference: ${errorMessage(err)}`);
    }
  }

  /**
   * The launcher "move" handler. The payload is the whole turn line so far
   * (Game.vue accumulates commands with ". "), so an incomplete line is just
   * rendered from a throwaway clone; a complete one is committed atomically
   * and only kept locally once the backend accepted it.
   */
  submitMove(move: string): Promise<void> {
    return this.enqueue(() => this.applyAndCommit(move));
  }

  /**
   * The actual "apply one move line, commit if it completed a turn" logic - deliberately NOT
   * wrapped in `enqueue` itself (only the public `submitMove` is), since `resolveAutoDecisions`
   * below must call this directly: it runs from INSIDE an already-executing enqueued callback, and
   * routing back through the public, `enqueue`-wrapping `submitMove` from there would deadlock
   * (the appended task would wait on `this.queue`, which is the very callback it's called from).
   *
   * `source: "premove"` (the fast-path in resolveAutoDecisions) swallows an invalid-move failure
   * silently instead of surfacing it as a user-facing error: the user never typed this move, a stale
   * premove is an expected/recoverable situation, and the offline edge function's own trigger fired
   * from this exact same current_seat change independently of this fast-path, so it will delete the
   * premove and record the failure on its own - duplicating that bookkeeping here would race it.
   */
  private async applyAndCommit(move: string, source: "manual" | "auto" | "premove" = "manual"): Promise<boolean> {
    const copy = this.clone();
    if (!move) {
      this.emitState(copy);
      return false;
    }
    // The seat this turn line belongs to: whoever the engine says must act
    // (accounts for mid-turn leech interrupts via tempCurrentPlayer).
    const seat = copy.playerToMove;
    // Captured before the move mutates `copy` - reconciliation (below) must only fire for the
    // seat's genuine RoundMove turn, never for a RoundLeech charge/decline decision that merely
    // happens to belong to the same seat (a queued premove is for the seat's UPCOMING turn, which
    // hasn't happened yet just because a leech interrupt got resolved).
    const phaseBeforeMove = this.engine.phase;
    try {
      copy.move(move);
      copy.generateAvailableCommandsIfNeeded();
    } catch (err) {
      if (source !== "premove") {
        this.callbacks.onError?.(`Invalid move "${move}": ${errorMessage(err)}`);
      }
      this.emitState(this.engine);
      return false;
    }

    if (copy.newTurn) {
      const finished = copy.phase === Phase.EndGame;
      const args: CommitTurnArgs = {
        gameId: this.gameId,
        seq: this.committedMoveCount + 1,
        seat,
        move,
        nextSeat: finished ? null : copy.playerToMove,
        finished,
        currentRound: copy.round,
        playerUpdates: playerUpdates(copy),
      };
      try {
        await this.backend.commitTurn(args);
      } catch (err) {
        // seq_conflict means someone else (another tab, another automated committer) already
        // landed the next turn - not alarming, just stale local state. Silently resync instead of
        // showing a scary error for something that isn't actually a problem (this also affects
        // auto-leech and the premove fast-path below, both of which can race a commit the same way).
        if (!isSeqConflict(err)) {
          this.callbacks.onError?.(`Could not save the turn (${errorMessage(err)}); reloading the game state.`);
        }
        await this.resyncNow();
        return false;
      }
      this.engine = copy;
      // Phase 3 (§10.7) - a manual move for a seat that still has a queue on file means the queue
      // didn't get the chance to fire for this turn (most commonly: the fast-path's own attempt
      // already failed silently and the human is now looking at the real board). Reconcile before
      // it goes stale for the seat's NEXT turn too. Not for source "premove"/"auto" - those are the
      // queue firing itself / an unrelated leech decision, nothing to reconcile there.
      if (source === "manual" && phaseBeforeMove === Phase.RoundMove) {
        await this.reconcileStaleQueue(seat, move);
      }
    }
    this.emitState(copy);
    await this.refreshPremoveState();
    // After emitting, not before: a chained auto-decision computes/commits/emits its own
    // further state, which must never be overwritten by this call's own (now-stale) copy.
    await this.resolveAutoDecisions();
    return copy.newTurn;
  }

  /**
   * Phase 3 (§10.7) - a stale queue left behind by a manual move that bypassed it (own device or
   * another one). A cleanliness measure, not a correctness backstop: a stale row that survives
   * fails safely at its next attempted use anyway (illegal -> notification), so a best-effort
   * failure here is never alarming.
   *
   * Sequential pops just the consumed head when it matches (the rest of the chain is still a valid
   * plan); anything else (a non-matching head, or priority mode entirely - the ranked list was only
   * ever for this one turn) clears the whole queue.
   */
  private async reconcileStaleQueue(seat: number, playedMove: string): Promise<void> {
    const rows = this.premoves.filter((p) => p.seat === seat).sort((a, b) => a.seq - b.seq);
    if (rows.length === 0) {
      return;
    }
    try {
      if (isPassMove(playedMove)) {
        // A pass ends this seat's participation in the round - any still-queued premoves (built
        // assuming the seat keeps acting this round) are moot regardless of mode (§8, resolved).
        await this.backend.cancelAllPremoves(this.gameId, seat);
      } else if (rows[0].mode === "sequential" && rows[0].move === playedMove) {
        await this.backend.cancelPremove(this.gameId, seat, rows[0].seq);
      } else {
        await this.backend.cancelAllPremoves(this.gameId, seat);
      }
    } catch {
      // best-effort - see doc comment above.
    }
  }

  /** Realtime INSERT handler for the moves table. */
  applyRemoteMove(row: MoveRow): Promise<void> {
    return this.enqueue(async () => {
      if (row.seq <= this.committedMoveCount) {
        // Our own commit echoing back, or an already-applied row.
        return;
      }
      if (row.seq === this.committedMoveCount + 1) {
        // Same RoundMove-only gate as applyAndCommit's own reconciliation call, captured before the
        // move mutates the clone - a remote RoundLeech decision for one of my seats is not that
        // seat's real turn, and must never be treated as one for reconciliation purposes.
        const phaseBeforeMove = this.engine.phase;
        const copy = this.clone();
        try {
          copy.move(row.move);
          copy.generateAvailableCommandsIfNeeded();
          if (copy.newTurn) {
            this.engine = copy;
            this.emitState(copy);
            // Phase 3 (§10.7) - this move came from somewhere other than our own fast-path (another
            // device, or the offline edge function): reconcile a stale queue the same way a manual
            // move does. Idempotent when the edge function already consumed the row(s) itself.
            if (this.autoDecide.isMySeat(row.seat) && phaseBeforeMove === Phase.RoundMove) {
              await this.reconcileStaleQueue(row.seat, row.move);
            }
            // A moves row arrived (PREMOVE_PLAN.md §3's refresh rule) - a committed turn, ours or
            // not, is exactly the moment the server may have consumed (or newly offered) a premove.
            await this.refreshPremoveState();
            // A remote move can hand control straight to one of the local user's own seats
            // (a leech interrupt), so this is a real trigger point too, not just submitMove.
            await this.resolveAutoDecisions();
            return;
          }
          // A stored row that doesn't complete a turn contradicts the
          // commitment rule — treat it like a gap and rebuild from scratch.
        } catch {
          // fall through to resync
        }
      }
      await this.resyncNow();
    });
  }

  /** Full catch-up from the stored move log (reconnects, gaps, conflicts). */
  resync(): Promise<void> {
    return this.enqueue(() => this.resyncNow());
  }

  /**
   * Re-emits without re-fetching - also the first point that reliably knows which seats are
   * "mine" in practice (hosted.ts computes `mySeats` only after `load()` resolves, then calls this
   * explicitly), so this is where auto-decisions actually get a chance to run for the very first
   * state a session sees, not just subsequent moves/remote updates.
   */
  emitCurrentState(): void {
    if (this.engine) {
      this.emitState(this.engine);
      // Called directly from hosted.ts, not from inside an existing enqueued callback (unlike
      // every other call site above) - route through the real queue so it can't race a concurrent
      // move/remote-update.
      this.enqueue(() => this.resolveAutoDecisions()).catch((err) => this.callbacks.onError?.(errorMessage(err)));
    }
  }

  private async resyncNow(): Promise<void> {
    const [game, moves] = await Promise.all([this.backend.fetchGame(this.gameId), this.backend.fetchMoves(this.gameId)]);

    // A resync can fire for reasons that have nothing to do with the game actually changing - a
    // backgrounded tab coming back to the foreground (hosted.ts's visibilitychange listener), or a
    // realtime channel reconnecting after a network blip. Rebuilding the Engine and re-emitting
    // unconditionally in those cases replaces the store's Engine with a new object even when its
    // content is identical, which Commands.vue's `watch: availableCommands` treats as a real
    // change - resetting `commandChain`/`buttonChain`, i.e. wiping out whatever multi-step
    // selection (e.g. mid-way through picking a Build-a-Mine hex) the user was in, with no action
    // of their own. Skip the rebuild when nothing has actually landed since our current engine:
    // `committedMoveCount` is always live (derived from `this.engine.moveHistory`, kept in sync by
    // every local commit/remote-move-apply already), so comparing it against the freshly-fetched
    // move count is reliable without needing `this.game`'s own cached fields to be kept in perfect
    // sync everywhere.
    const unchanged = this.engine && moves.length === this.committedMoveCount && game.status === this.game?.status;
    this.game = game;
    if (!unchanged) {
      this.engine = this.buildEngine(game, moves);
      this.emitState(this.engine);
    }
    await this.refreshPremoveState();
    await this.resolveAutoDecisions();
  }

  /**
   * "Auto leech" (see logic/auto-decide.ts and the AutoDecideConfig doc comment above) - a no-op
   * unless it's currently one of the local user's own seats to decide something auto-decidable per
   * their own preference. Computes the resulting move on a disposable clone and, if there is one,
   * runs it through the same apply/commit logic a manual click would use (so other seated players
   * see it exactly like any other move) - never mutates `this.engine` directly itself.
   *
   * Once there's no more auto-leech work, tries the premove fast-path (PREMOVE_PLAN.md §5, mode-
   * aware since Phase 3 §10.5): if it's now genuinely this seat's turn (Phase.RoundMove) and this
   * session owns that seat and has a queue for it, decide via the SAME shared `resolvePremoveQueue`
   * the offline edge function uses, and play the winning move immediately through the normal commit
   * path instead of waiting for the edge function's trigger round-trip. `commit_turn`/
   * `commit_automated_turn`'s atomic seq check means whichever of {this fast-path, the edge
   * function} lands first wins - the loser gets `seq_conflict` and silently resyncs (see
   * applyAndCommit's catch above). A "failed" resolution is left entirely for the edge function to
   * clean up (delete + failure row) rather than duplicating that bookkeeping on the client - same
   * Phase 1 philosophy, now covering the cascade/all-illegal cases too.
   */
  private async resolveAutoDecisions(): Promise<void> {
    if (!this.engine || this.engine.playerToMove === undefined) {
      return;
    }
    const seat = this.engine.playerToMove;
    const autoChargePower = this.autoDecide.getAutoChargePower();
    if (autoChargePower !== "ask" && this.autoDecide.isMySeat(seat)) {
      const move = autoDecideChargePower(this.clone(), autoChargePower, this.autoDecide.isMySeat);
      if (move) {
        // Not `submitMove` - see applyAndCommit's own doc comment on why that would deadlock here.
        await this.applyAndCommit(move, "auto");
        return;
      }
    }

    if (this.engine.phase === Phase.RoundMove && this.autoDecide.isMySeat(seat)) {
      const rows = this.premoves.filter((p) => p.seat === seat);
      if (rows.length === 0) {
        return;
      }
      const mode = rows[0].mode;
      const decision: PremoveResolution = resolvePremoveQueue(() => this.clone(), seat, rows, mode);
      if (decision.outcome !== "success") {
        return;
      }
      const committed = await this.applyAndCommit(decision.move, "premove");
      // Unlike the offline edge function (which uses commit_automated_turn and deletes the
      // premove row(s) itself), this fast-path went through the normal commit_turn RPC - so on
      // success, every row the resolver consumed must be cleaned up here, or it would sit there and
      // be attempted again next time this seat's turn comes around.
      if (committed) {
        this.callbacks.onPremovePlayed?.(seat, decision.move, { rank: decision.rank, totalRanks: decision.totalRanks });
        try {
          for (const seq of decision.consumedSeqs) {
            await this.backend.cancelPremove(this.gameId, seat, seq);
          }
          await this.refreshPremoveState();
        } catch {
          // Best-effort: worst case a played premove lingers in the list until the next refresh
          // notices it's gone from the server's perspective too (RLS still scopes it correctly).
        }
      }
    }
  }

  private async refreshPremoveState(): Promise<void> {
    try {
      const [premoves, failures] = await Promise.all([
        this.backend.fetchPremoves(this.gameId),
        this.backend.fetchPremoveFailures(this.gameId),
      ]);
      this.premoves = premoves;
      this.premoveFailures = failures;
      this.callbacks.onPremoveState?.(premoves, failures);
    } catch {
      // Best-effort display data - never blocks gameplay if it fails to load.
    }
  }

  private buildEngine(game: GameRow, moves: MoveRow[]): Engine {
    const ordered = [...moves].sort((a, b) => a.seq - b.seq);
    const engine = new Engine([initMoveLine(game), ...ordered.map((m) => m.move)], engineOptions(game) as any);
    engine.generateAvailableCommandsIfNeeded();
    for (const p of this.players) {
      if (engine.players[p.seat]) {
        engine.players[p.seat].name = p.display_name || p.invited_email;
      }
    }
    return engine;
  }

  private clone(): Engine {
    return Engine.fromData(JSON.parse(JSON.stringify(this.engine)));
  }

  private emitState(engine: Engine): void {
    this.callbacks.onState(JSON.parse(JSON.stringify(engine)));
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const run = this.queue.then(fn, fn);
    // Keep the chain alive even when a step rejects; the step's own promise
    // still surfaces the rejection to its caller.
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
