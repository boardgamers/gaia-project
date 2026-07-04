import Engine, { Phase } from "@gaia-project/engine";
import { AutoCharge } from "@gaia-project/engine/src/player";
import { autoDecideChargePower } from "../logic/auto-decide";
import { CommitTurnArgs, GameRow, HostedBackend, HostedCallbacks, MoveRow, PlayerRow, PlayerUpdate } from "./types";

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
      await this.resolveAutoDecisions();
    });
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
   */
  private async applyAndCommit(move: string): Promise<void> {
    const copy = this.clone();
    if (!move) {
      this.emitState(copy);
      return;
    }
    // The seat this turn line belongs to: whoever the engine says must act
    // (accounts for mid-turn leech interrupts via tempCurrentPlayer).
    const seat = copy.playerToMove;
    try {
      copy.move(move);
      copy.generateAvailableCommandsIfNeeded();
    } catch (err) {
      this.callbacks.onError?.(`Invalid move "${move}": ${errorMessage(err)}`);
      this.emitState(this.engine);
      return;
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
        this.callbacks.onError?.(`Could not save the turn (${errorMessage(err)}); reloading the game state.`);
        await this.resyncNow();
        return;
      }
      this.engine = copy;
    }
    this.emitState(copy);
    // After emitting, not before: a chained auto-decision computes/commits/emits its own
    // further state, which must never be overwritten by this call's own (now-stale) copy.
    await this.resolveAutoDecisions();
  }

  /** Realtime INSERT handler for the moves table. */
  applyRemoteMove(row: MoveRow): Promise<void> {
    return this.enqueue(async () => {
      if (row.seq <= this.committedMoveCount) {
        // Our own commit echoing back, or an already-applied row.
        return;
      }
      if (row.seq === this.committedMoveCount + 1) {
        const copy = this.clone();
        try {
          copy.move(row.move);
          copy.generateAvailableCommandsIfNeeded();
          if (copy.newTurn) {
            this.engine = copy;
            this.emitState(copy);
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
    this.game = game;
    this.engine = this.buildEngine(game, moves);
    this.emitState(this.engine);
    await this.resolveAutoDecisions();
  }

  /**
   * "Auto leech" (see logic/auto-decide.ts and the AutoDecideConfig doc comment above) - a no-op
   * unless it's currently one of the local user's own seats to decide something auto-decidable per
   * their own preference. Computes the resulting move on a disposable clone and, if there is one,
   * runs it through the same apply/commit logic a manual click would use (so other seated players
   * see it exactly like any other move) - never mutates `this.engine` directly itself.
   */
  private async resolveAutoDecisions(): Promise<void> {
    if (!this.engine || this.engine.playerToMove === undefined) {
      return;
    }
    const autoChargePower = this.autoDecide.getAutoChargePower();
    if (autoChargePower === "ask" || !this.autoDecide.isMySeat(this.engine.playerToMove)) {
      return;
    }

    const move = autoDecideChargePower(this.clone(), autoChargePower, this.autoDecide.isMySeat);
    if (move) {
      // Not `submitMove` - see applyAndCommit's own doc comment on why that would deadlock here.
      await this.applyAndCommit(move);
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
