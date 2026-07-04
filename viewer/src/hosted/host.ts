import Engine, { Phase } from "@gaia-project/engine";
import { CommitTurnArgs, GameRow, HostedBackend, HostedCallbacks, MoveRow, PlayerRow, PlayerUpdate } from "./types";

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
    private readonly callbacks: HostedCallbacks
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
    });
  }

  /**
   * The launcher "move" handler. The payload is the whole turn line so far
   * (Game.vue accumulates commands with ". "), so an incomplete line is just
   * rendered from a throwaway clone; a complete one is committed atomically
   * and only kept locally once the backend accepted it.
   */
  submitMove(move: string): Promise<void> {
    return this.enqueue(async () => {
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
    });
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

  emitCurrentState(): void {
    if (this.engine) {
      this.emitState(this.engine);
    }
  }

  private async resyncNow(): Promise<void> {
    const [game, moves] = await Promise.all([this.backend.fetchGame(this.gameId), this.backend.fetchMoves(this.gameId)]);
    this.game = game;
    this.engine = this.buildEngine(game, moves);
    this.emitState(this.engine);
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
