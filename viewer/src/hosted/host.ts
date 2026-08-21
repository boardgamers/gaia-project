import Engine, { Command, Phase, ResearchField } from "@gaia-project/engine";
import { AutoCharge } from "@gaia-project/engine/src/player";
import { autoDecideChargePower } from "../logic/auto-decide";
import { factionName } from "../data/factions";
import { researchData } from "../data/research";
import { compactMoveSummary } from "../logic/move-summary";
import {
  CancelTriggerRow as MatcherCancelTriggerRow,
  matchCancelTriggers,
  SeatedMove,
} from "../logic/premove-cancel-trigger";
import { PremoveResolution, resolvePremoveQueue } from "../logic/premove-resolver";
import { isLegacySequentialBidRound, sealedBidMove, sealedBidPhase } from "../logic/sealed-bid";
import {
  CancelTriggerRow,
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
  SealedBidEntry,
  SealedBidStatus,
} from "./types";

const SEQ_CONFLICT_PREFIX = "seq_conflict";

function isSeqConflict(err: unknown): boolean {
  return errorMessage(err).includes(SEQ_CONFLICT_PREFIX);
}

function isSeatOwnershipError(err: unknown): boolean {
  return errorMessage(err).includes("seat ") && errorMessage(err).includes(" is not yours");
}

/** A move line is "<player> <command> <args...>", possibly several joined by ". " - true if any of
 * them is a pass (§8/§10.7: a manual pass always clears the seat's queue, regardless of mode). */
function isPassMove(move: string): boolean {
  return move.split(". ").some((part) => part.trim().split(/\s+/)[1] === "pass");
}

/** DB row (types.ts, snake_case) -> the matcher's own camelCase shape (premove-cancel-trigger.ts). */
function toMatcherTriggers(rows: CancelTriggerRow[]): MatcherCancelTriggerRow[] {
  return rows.map((r) => ({
    seq: r.seq,
    kind: r.kind,
    watchedSeat: r.watched_seat,
    move: r.move,
    atoms: r.atoms,
    config: r.config,
    match: r.match,
    armedFromMoveCount: r.armed_from_move_count,
  }));
}

/** Plain-language text for one matched atom, for the cancelled-notice/fired-state copy (§8.5) - a
 * looser cousin of the matcher module's own candidateAtoms labels (that one describes a move being
 * COMPOSED; this one describes one that already happened, so it reads in the past tense). */
function describeMatchedAtom(atom: string): string {
  const [command, ...rest] = atom.split(":");
  const trackName = (code: string) => researchData[code as ResearchField]?.name ?? code;
  switch (command) {
    case "build":
      return `built ${rest[0] ?? "something"} at ${rest[1] ?? "a hex"}`;
    case "up":
      return `advanced ${trackName(rest[0])}`;
    case "tech":
      return `took the tech tile at ${trackName(rest[0])}`;
    case "action":
      return `took board action ${rest[0] ?? ""}`.trim();
    case "special":
      return `used a special action`;
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

/** The premove_failures.reason text for a fired cancel trigger (§8.5's "Cancelled - ..." copy):
 * third person for a 'move' trigger (names the watched opponent), first person for 'leech'. */
function describeCancelTriggerReason(
  trigger: MatcherCancelTriggerRow,
  atom: string,
  watchedPlayer: { faction?: string; name?: string } | null
): string {
  const description = describeMatchedAtom(atom);
  if (trigger.kind === "leech") {
    return `you ${description}`;
  }
  const label = watchedPlayer?.faction ? factionName(watchedPlayer.faction as any) : watchedPlayer?.name ?? "Opponent";
  return `${label} ${description}`;
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
  getAutoChargeMaxPassedRoundLeech?: () => number;
};

const noAutoDecide: AutoDecideConfig = { isMySeat: () => false, getAutoChargePower: () => "ask" };

export function initMoveLine(game: GameRow): string {
  return `init ${game.player_count} ${game.seed}`;
}

export { sealedBidMove };

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
 * - `null` = no lock (hot-seat) only when the user owns every seat (test games).
 * - `-1` (an out-of-range placeholder seat, same one the pre-load window in
 *   hosted.ts uses) for a user who owns NO seats at all — a spectator. RLS and
 *   commit_turn's server-side seat-ownership check mean a spectator could never
 *   actually commit a move, but leaving the UI unlocked for them still exposed
 *   every control (build/upgrade/pass/etc.) as if they could act, which reads as
 *   "I can play on someone else's behalf." `Game.vue`'s `canPlay` already treats
 *   any negative seat as unplayable, so this reuses that path instead of adding
 *   a new one.
 * - Otherwise the user's seat that must act now, falling back to their first
 *   seat while an opponent (or an unowned seat) is on turn. Driven by
 *   `playerToMove`, so leech interrupts unlock the right seat (§J2).
 */
export function seatToLock(mySeats: number[], playerCount: number, playerToMove: number | undefined): number | null {
  if (mySeats.length === 0) {
    return playerCount > 0 ? -1 : null;
  }
  if (mySeats.length >= playerCount) {
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

export function latestMoveSummary(engine: Engine, move: string): string | null {
  return compactMoveSummary(move, engine);
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
  cancelTriggers: CancelTriggerRow[] = [];

  // Seat-tagged committed move log, kept in lockstep with `this.engine` by every path that advances
  // it (load/resync full-refetch it; a local commit/applied remote move appends the one new row) -
  // the shared cancel-trigger matcher needs each move's SEAT, which a bare `engine.moveHistory`
  // string doesn't carry (only the faction name prefix, not the numeric seat a trigger watches).
  private committedMoves: SeatedMove[] = [];

  // Serializes submit/remote/resync so an in-flight commit can't interleave
  // with a realtime apply on the same engine.
  private queue: Promise<void> = Promise.resolve();
  // Sealed-bid auctions - true while this client is closing the auction, see refreshSealedBidState.
  private revealing = false;

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
      await this.backend.claimMySeats();
      const [game, players, moves] = await Promise.all([
        this.backend.fetchGame(this.gameId),
        this.backend.fetchPlayers(this.gameId),
        this.backend.fetchMoves(this.gameId),
      ]);
      await this.repairMoveCountIfNeeded(game, moves);
      this.game = game;
      this.players = players;
      this.committedMoves = [...moves].sort((a, b) => a.seq - b.seq);
      this.engine = this.buildEngine(game, moves);
      this.emitState(this.engine);
      await this.refreshPremoveState();
      // Also the fallback that closes a sealed-bid auction whose last submitter went away before
      // the reveal landed: every client that opens the game re-checks.
      await this.refreshSealedBidState();
      await this.resolveAutoDecisions();
    });
  }

  /**
   * The simultaneous bid round of either sealed-bid auction variant - the Preference Split's
   * (`AuctionVariant.PreferenceSplit`) and, since migration 20260812130000, the Silent Auction's
   * (`AuctionVariant.Silent`). `logic/sealed-bid.ts` is what decides which round an engine state is
   * in, and what its moves are called.
   *
   * That round is the one part of a hosted game that does NOT go through `submitMove`: every player
   * bids at the same time and none of them may see another's numbers, so the submissions are held
   * server-side (`auction_sealed_bids`) instead of being committed as moves. Once the server
   * reports every seat in, ANY client may close the auction - `reveal_sealed_bids` appends every
   * move in one transaction, and its seq check makes that exactly-once even if several clients
   * notice at the same instant (the losers get `seq_conflict` and simply resync into the result).
   *
   * That "any client" is deliberate: it also covers the case where the last submitter closes their
   * browser before the reveal lands, since every other client re-checks on load and after each
   * status refresh.
   */
  submitSealedBid(seat: number, bids: SealedBidEntry[]): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.submitSealedBid(this.gameId, seat, bids);
      await this.refreshSealedBidState();
    });
  }

  /** Re-reads submission progress, emits it, and closes the auction if it is complete. */
  refreshSealedBids(): Promise<void> {
    return this.enqueue(() => this.refreshSealedBidState());
  }

  private async refreshSealedBidState(): Promise<void> {
    // `revealing` keeps the reveal -> resync -> refresh chain from re-entering itself if the reveal
    // could not land (the phase would still be the bid phase with every seat submitted).
    const sealed = sealedBidPhase(this.engine);
    if (!sealed || isLegacySequentialBidRound(this.engine) || this.revealing) {
      return;
    }
    let status: SealedBidStatus;
    try {
      status = await this.backend.fetchSealedBidStatus(this.gameId);
    } catch (err) {
      this.callbacks.onError?.(`Could not read the auction's progress: ${errorMessage(err)}`);
      return;
    }
    this.callbacks.onSealedBidState?.(status);

    // Tell the server the auction is open, so everyone who still owes a bid gets a push (migration
    // 20260808120000). Same "any client may do it" shape as the reveal below, and for the same
    // reason: `current_seat` doesn't move during simultaneous bidding, so nothing else in the
    // system would ever notice the phase began - not even the client that committed the final
    // faction pick, which may well have closed its tab by now. Exactly-once server-side, so calling
    // it from every client on every refresh is correct rather than merely harmless. Best-effort: a
    // failure here costs a notification, never the auction.
    if (status.submittedSeats.length < status.playerCount) {
      try {
        await this.backend.announceSealedBidAuction(this.gameId);
      } catch {
        // Non-critical - the bid panel itself is what the players actually act on.
      }
    }

    if (status.playerCount > 0 && status.submittedSeats.length >= status.playerCount) {
      this.revealing = true;
      try {
        await this.revealSealedBids(sealed.command);
      } finally {
        this.revealing = false;
      }
    }
  }

  private async revealSealedBids(command: Command): Promise<void> {
    // The server builds the move text itself, from the rows it stores - nothing about the bids is
    // taken from this client. All it contributes is `nextSeat`, the seat the engine lands on once
    // the auction has resolved, which can only be known by actually replaying it. That is the same
    // trust model as `commit_turn`'s own client-computed `p_next_seat`, and the bids are readable
    // here by now precisely because every seat has submitted.
    const seq = this.committedMoveCount + 1;
    let nextSeat = 0;
    try {
      const rows = await this.backend.fetchSealedBids(this.gameId);
      // A FULL replay, not `clone()`: the auction's tiebreaks draw from the game's seeded PRNG,
      // whose position comes from having generated the map - and a `fromData` round trip does not
      // carry that. Only a replay from the init line reproduces the same draw the authoritative
      // replay will make on every other client.
      const replayed = new Engine(
        [
          ...this.engine.moveHistory,
          ...[...rows].sort((a, b) => a.seat - b.seat).map((row) => sealedBidMove(row.seat, row.bids, command)),
        ],
        engineOptions(this.game) as any
      );
      replayed.generateAvailableCommandsIfNeeded();
      nextSeat = replayed.playerToMove ?? 0;
    } catch (err) {
      this.callbacks.onError?.(`Could not resolve the auction locally (${errorMessage(err)}); reloading.`);
      await this.resyncNow();
      return;
    }

    try {
      await this.backend.revealSealedBids(this.gameId, seq, nextSeat);
    } catch (err) {
      // Another client closed the auction first (or the move log moved on). Not an error worth
      // showing - resyncing lands us on the very same resolved state.
      if (!isSeqConflict(err)) {
        this.callbacks.onError?.(`Could not close the auction (${errorMessage(err)}); reloading the game state.`);
      }
    }
    await this.resyncNow();
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

  /** Premove UI redesign (Gaia 9) - "stage until confirmed" for an edit: nothing is sent until
   * this is actually called, so backing out of an in-progress edit leaves the original untouched. */
  editPremove(seat: number, seq: number, move: string): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.editPremove(this.gameId, seat, seq, move);
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

  /** Arms a new cancel trigger (§3/§4a). Discards the new seq the same way queuePremove discards
   * its own - the caller re-renders from the refreshed `cancelTriggers` list, not a return value. */
  armCancelTrigger(
    seat: number,
    watchedSeat: number,
    move: string,
    atoms: string[],
    kind: "move" | "leech",
    config: CancelTriggerRow["config"] = {}
  ): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.armCancelTrigger(this.gameId, seat, watchedSeat, move, atoms, kind, config);
      await this.refreshPremoveState();
    });
  }

  disarmCancelTrigger(seat: number, seq: number): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.disarmCancelTrigger(this.gameId, seat, seq);
      await this.refreshPremoveState();
    });
  }

  disarmAllCancelTriggers(seat: number): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.disarmAllCancelTriggers(this.gameId, seat);
      await this.refreshPremoveState();
    });
  }

  editCancelTrigger(
    seat: number,
    seq: number,
    move: string,
    atoms: string[],
    config: CancelTriggerRow["config"]
  ): Promise<void> {
    return this.enqueue(async () => {
      await this.backend.editCancelTrigger(this.gameId, seat, seq, move, atoms, config);
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
   * rendered from a throwaway clone; a complete one is committed atomically.
   *
   * Completed turns are applied locally BEFORE awaiting the backend round-trip:
   * otherwise setup-turn confirms (notably initial mines in round 0) can sit
   * on a stale "Confirm" prompt long enough to look broken even when the move
   * did save. A commit failure still resyncs back to the real stored state.
   */
  submitMove(move: string): Promise<void> {
    return this.enqueue(async () => {
      await this.applyAndCommit(move);
    });
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

    let emittedCommittedState = false;
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
        latestMoveSummary: latestMoveSummary(copy, move),
        playerUpdates: playerUpdates(copy),
      };
      // Completed-turn submits should feel immediate on the acting browser too:
      // keep the optimistic state locally unless the backend rejects it.
      this.engine = copy;
      this.emitState(copy);
      emittedCommittedState = true;
      // Kept in lockstep with the optimistic engine update above - a real commit failure below
      // falls through to resyncNow(), which fully rebuilds this from a fresh fetch anyway.
      this.committedMoves = [...this.committedMoves, { seq: args.seq, seat, move }];
      try {
        await this.backend.commitTurn(args);
      } catch (err) {
        if (isSeatOwnershipError(err)) {
          try {
            await this.backend.claimMySeats();
            await this.backend.commitTurn(args);
            err = null;
          } catch (retryErr) {
            err = retryErr;
          }
        }
        if (err === null) {
          // The one-shot re-claim + retry succeeded; keep the optimistic committed state.
        } else {
          if (isSeqConflict(err)) {
            await this.repairMoveCountIfNeeded();
          }
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
      }
      // Phase 3 (§10.7) - a manual move for a seat that still has a queue on file means the queue
      // didn't get the chance to fire for this turn (most commonly: the fast-path's own attempt
      // already failed silently and the human is now looking at the real board). Reconcile before
      // it goes stale for the seat's NEXT turn too. Not for source "premove"/"auto" - those are the
      // queue firing itself / an unrelated leech decision, nothing to reconcile there.
      if (source === "manual" && phaseBeforeMove === Phase.RoundMove) {
        await this.reconcileStaleQueue(seat, move);
      }
    }
    if (!emittedCommittedState) {
      this.emitState(copy);
    }
    await this.refreshPremoveState();
    // The move just committed may have been the last faction pick, i.e. the one that opens a
    // sealed-bid auction's bid phase. A no-op in every other phase (see refreshSealedBidState).
    await this.refreshSealedBidState();
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
            this.committedMoves = [...this.committedMoves, { seq: row.seq, seat: row.seat, move: row.move }];
            // Phase 3 (§10.7) - this move came from somewhere other than our own fast-path (another
            // device, or the offline edge function): reconcile a stale queue the same way a manual
            // move does. Idempotent when the edge function already consumed the row(s) itself.
            if (this.autoDecide.isMySeat(row.seat) && phaseBeforeMove === Phase.RoundMove) {
              await this.reconcileStaleQueue(row.seat, row.move);
            }
            // A moves row arrived (PREMOVE_PLAN.md §3's refresh rule) - a committed turn, ours or
            // not, is exactly the moment the server may have consumed (or newly offered) a premove.
            await this.refreshPremoveState();
            // ...and, if it was another player's final faction pick, the moment a sealed-bid
            // auction's bid phase opened for us. A no-op in every other phase.
            await this.refreshSealedBidState();
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
    const [game, moves] = await Promise.all([
      this.backend.fetchGame(this.gameId),
      this.backend.fetchMoves(this.gameId),
    ]);
    const ordered = [...moves].sort((a, b) => a.seq - b.seq);
    await this.repairMoveCountIfNeeded(game, ordered);

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
    const unchanged =
      this.engine &&
      ordered.length === this.committedMoveCount &&
      game.status === this.game?.status &&
      ordered.every((row, index) => {
        const replayed = this.engine.moveHistory[index + 1] ?? "";
        return replayed === row.move || replayed.startsWith(`${row.move} `) || replayed.startsWith(`${row.move}(`);
      });
    this.game = game;
    if (!unchanged) {
      this.committedMoves = ordered;
      this.engine = this.buildEngine(game, ordered);
      this.emitState(this.engine);
    }
    await this.refreshPremoveState();
    // Catching up after a reconnect can land straight in a sealed bid phase; the
    // `revealing` guard inside is what keeps the reveal -> resync -> refresh chain from re-entering.
    await this.refreshSealedBidState();
    await this.resolveAutoDecisions();
  }

  private async repairMoveCountIfNeeded(game?: GameRow, moves?: MoveRow[]): Promise<void> {
    const row = game ?? this.game;
    const orderedMoves = moves ?? new Array(this.committedMoveCount);
    if (!row || row.move_count === orderedMoves.length) {
      return;
    }
    try {
      row.move_count = await this.backend.repairMoveCount(this.gameId);
    } catch {
      // Best-effort repair: if it fails, the normal commit/resync path still surfaces
      // the underlying problem instead of hiding it behind a secondary RPC error.
    }
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
    // Call this even when the preference is "ask": autoDecideChargePower still auto-resolves the
    // engine's always-safe deterministic leech decisions (a passed player's pointless last-round
    // charge) so nobody has to wait on them, while any genuine leech is still left for a manual
    // decision. See logic/auto-decide.ts's doc comment.
    if (this.autoDecide.isMySeat(seat)) {
      const move = autoDecideChargePower(
        this.clone(),
        autoChargePower,
        this.autoDecide.isMySeat,
        this.autoDecide.getAutoChargeMaxPassedRoundLeech?.() ?? 0
      );
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

      // Cancel triggers (before resolving the queue itself, per the design's ordering, mirrored
      // exactly in resolve-automation/logic.ts so online/offline never disagree about whether a
      // queue survived) - gated on a non-empty queue above since a match with nothing queued has
      // no effect to apply (nothing to cancel) and would only disarm protection prematurely.
      const armedTriggers = this.cancelTriggers.filter((t) => t.seat === seat);
      if (armedTriggers.length > 0) {
        const match = matchCancelTriggers(toMatcherTriggers(armedTriggers), this.committedMoves, this.engine.map);
        if (match) {
          const watchedEnginePlayer = this.engine.players[match.trigger.watchedSeat];
          const watchedRow = this.players.find((p) => p.seat === match.trigger.watchedSeat);
          const reason = describeCancelTriggerReason(match.trigger, match.atom, {
            faction: watchedEnginePlayer?.faction,
            name: watchedRow?.display_name,
          });
          let won = false;
          try {
            won = await this.backend.resolveCancelTriggerMatch(this.gameId, seat, reason);
          } catch {
            // Best-effort - see resolve_cancel_trigger_match's own doc comment on the race it
            // arbitrates. A failure here just leaves the trigger armed to try again next time.
          }
          await this.refreshPremoveState();
          if (won) {
            this.callbacks.onCancelTriggerFired?.(seat, reason);
          }
          return;
        }
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
      const [premoves, failures, cancelTriggers] = await Promise.all([
        this.backend.fetchPremoves(this.gameId),
        this.backend.fetchPremoveFailures(this.gameId),
        this.backend.fetchCancelTriggers(this.gameId),
      ]);
      this.premoves = premoves;
      this.premoveFailures = failures;
      this.cancelTriggers = cancelTriggers;
      this.callbacks.onPremoveState?.(premoves, failures);
      this.callbacks.onCancelTriggerState?.(cancelTriggers);
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
        engine.players[p.seat].name = p.display_name || "Unknown player";
      }
    }
    return engine;
  }

  private clone(): Engine {
    return Engine.fromData(JSON.parse(JSON.stringify(this.engine)));
  }

  /**
   * `engine === this.engine` is exactly "this state is committed", with no extra bookkeeping: every
   * partially composed turn is rendered from a throwaway clone (applyAndCommit's `copy`), while
   * every committed one - load, resync, a locally completed turn, an applied remote move - is only
   * emitted after `this.engine` has been pointed at it. Consumers that must never persist half a
   * turn (the offline copy in hosted/offline-mirror.ts) key off `onCommittedState` instead of
   * re-deriving that distinction from the state itself.
   */
  private emitState(engine: Engine): void {
    const data = JSON.parse(JSON.stringify(engine));
    this.callbacks.onState(data);
    if (engine === this.engine) {
      this.callbacks.onCommittedState?.(data);
    }
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
