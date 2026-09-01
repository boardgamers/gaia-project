// Row shapes for a hosted multiplayer backend (premove/sealed-bid/game-row shapes used by game
// components and the store).

import type { SealedBidVariant } from "./sealed-bid";

export type GameRow = {
  id: string;
  name: string;
  seed: string;
  player_count: number;
  options: Record<string, unknown>;
  status: "open" | "active" | "finished";
  current_seat: number | null;
  starting_seat?: number;
  setup_move?: string | null;
  move_count: number;
  // Cached lobby-list display data - null until this game's first post-migration commit (see the
  // migration's own doc comment). Never read by game logic, only the Lobby row.
  current_round: number | null;
  latest_move_summary: string | null;
  // Cached lobby-list "time since last move" (migration 0026) - avoids an unbounded cross-game
  // moves query that silently hit PostgREST's row cap once this project passed ~1000 total moves.
  latest_move_committed_at?: string | null;
  abandoned_at?: string | null;
};

export type PlayerRow = {
  game_id: string;
  seat: number;
  invited_email: string;
  user_id: string | null;
  display_name: string;
  faction: string | null;
  score: number | null;
  /** Refreshed every ~20s while a tab for this seat is open - used as a "seen recently" presence
   * fallback when there's no live presence entry. Optional so existing test fixtures that predate
   * this field don't all need updating. */
  last_active_at?: string | null;
};

export type MoveRow = {
  game_id: string;
  seq: number;
  seat: number;
  move: string;
};

export type PlayerUpdate = { seat: number; faction: string; score: number };

export type CommitTurnArgs = {
  gameId: string;
  seq: number;
  seat: number;
  move: string;
  nextSeat: number | null;
  finished: boolean;
  /** Freshly-computed from the local engine at commit time (see host.ts) - cached lobby display
   * data only, see GameRow/PlayerRow's current_round/faction/score. */
  currentRound: number;
  latestMoveSummary: string | null;
  playerUpdates: PlayerUpdate[];
};

// Premove (PREMOVE_PLAN.md, Phase 1) - RLS already scopes selects to the caller's own seats, so
// fetches don't take a seat filter; queue/cancel take an explicit seat since a multi-seat owner is
// never ambiguous (see the RPCs in 0010_premoves.sql).
// Phase 3 (§10.1-10.4) added `mode` - all of a seat's rows share one mode; `seq` means turn-order in
// sequential mode, priority-rank in priority mode.
export type PremoveMode = "sequential" | "priority";
export type PremoveRow = { seat: number; seq: number; move: string; mode: PremoveMode; queued_move_count: number };
export type PremoveFailureRow = {
  id: string;
  seat: number;
  move: string;
  reason: string;
  read_at: string | null;
  // 'cancelled' (added for premove cancel triggers) reads differently in the UI ("cancelled by
  // trigger" rather than "your premove couldn't be played") - see PremoveBar/Game.vue.
  kind: "failure" | "cancelled";
};

// Premove cancel triggers - a trigger watches one opponent's moves (kind='move') or the owner's
// own power charges (kind='leech') and, if it matches, clears the owner's entire premove queue
// instead of ever playing anything. The shared matcher (logic/premove-cancel-trigger.ts) uses its
// own camelCase CancelTriggerRow shape instead - callers adapt between the two.
export type CancelTriggerKind = "move" | "leech";
export type CancelTriggerLeechConfig = { mode: "gained" | "offered"; minPower: number };
export type CancelTriggerRow = {
  seat: number;
  seq: number;
  kind: CancelTriggerKind;
  watched_seat: number;
  move: string;
  atoms: string[];
  config: CancelTriggerLeechConfig | Record<string, never>;
  match: "any" | "all";
  armed_from_move_count: number;
};

// The sealed-bid side channel, shared by both simultaneous-bid auction variants: the Preference
// Split (AuctionVariant.PreferenceSplit) and the Silent Auction (AuctionVariant.Silent, migration
// 20260812130000). Bids do NOT go through commitTurn while the auction is open: they are held
// server-side (auction_sealed_bids, migration 20260805120000) where RLS shows a player only their
// own row, and become one ordinary move per seat in one transaction once everybody has submitted.
// See that migration's header for why the ordinary move log cannot be used here.
export type SealedBidEntry = { faction: string; points: number };
export type SealedBidStatus = {
  playerCount: number;
  /** Which auction is being bid on, so a panel can tell it is looking at its own game's status. */
  variant: SealedBidVariant | null;
  /** Preference Split only - the exact total every submission has to add up to. Null for silent. */
  budget: number | null;
  /** Silent Auction only - the ceiling on any single bid. Null for preference-split. */
  maxBid: number | null;
  /** Which seats have submitted. Progress only - never carries anybody's points. */
  submittedSeats: number[];
};

// The data layer a hosted game backend needs to provide.
export interface HostedBackend {
  fetchGame(gameId: string): Promise<GameRow>;
  fetchPlayers(gameId: string): Promise<PlayerRow[]>;
  fetchMoves(gameId: string): Promise<MoveRow[]>;
  claimMySeats(): Promise<void>;
  repairMoveCount(gameId: string): Promise<number>;
  commitTurn(args: CommitTurnArgs): Promise<void>;
  fetchPremoves(gameId: string): Promise<PremoveRow[]>;
  fetchPremoveFailures(gameId: string): Promise<PremoveFailureRow[]>;
  queuePremove(gameId: string, seat: number, move: string, mode: PremoveMode): Promise<number>;
  cancelPremove(gameId: string, seat: number, seq: number): Promise<void>;
  // Premove UI redesign (Gaia 9) - updates a queued premove's move in place (Sequential also
  // cascade-deletes everything after it, same as a cancel there - see the migration).
  editPremove(gameId: string, seat: number, seq: number, move: string): Promise<void>;
  // Phase 3 (§10.4) - clears a seat's whole queue in one call: the mode-toggle confirm, and the
  // §10.7 reconciliation cases.
  cancelAllPremoves(gameId: string, seat: number): Promise<void>;
  // Phase 3, priority mode only - swaps a row's rank with its neighbour.
  reorderPremove(gameId: string, seat: number, seq: number, direction: "up" | "down"): Promise<void>;
  markPremoveFailureRead(id: string): Promise<void>;
  // Phase 2 (offline auto-leech) - persists the client's existing auto-charge preference per seat
  // so resolve-automation can honor it while the player is offline.
  setAutoCharge(gameId: string, seat: number, pref: string): Promise<void>;
  /** Preference Split Auction: submission progress. Safe to call from any seat at any time. */
  fetchSealedBidStatus(gameId: string): Promise<SealedBidStatus>;
  /** Announces the open bid phase, so every player who still owes a bid gets a push. Server-side
   * exactly-once (migration 20260808120000); returns whether THIS call was the one that announced,
   * so every client can call it unconditionally while sitting in the phase. */
  announceSealedBidAuction(gameId: string): Promise<boolean>;
  /** Submits one seat's whole split. Returns how many seats have submitted afterwards. */
  submitSealedBid(gameId: string, seat: number, bids: SealedBidEntry[]): Promise<number>;
  /** Every seat's submitted split. RLS only ever returns rows once all of them are in (before that
   * it returns just the caller's own), so this is safe to call and useless to call early. */
  fetchSealedBids(gameId: string): Promise<{ seat: number; bids: SealedBidEntry[] }[]>;
  /** Appends every sealed bid to the move log at once. Returns the number of moves appended, or 0
   * if another client had already done it. Throws `seq_conflict` when this client was racing one. */
  revealSealedBids(gameId: string, seq: number, nextSeat: number): Promise<number>;
  // Premove cancel triggers - RLS scopes selects to the caller's own seats, same as premoves.
  fetchCancelTriggers(gameId: string): Promise<CancelTriggerRow[]>;
  armCancelTrigger(
    gameId: string,
    seat: number,
    watchedSeat: number,
    move: string,
    atoms: string[],
    kind: CancelTriggerKind,
    config: CancelTriggerLeechConfig | Record<string, never>
  ): Promise<number>;
  disarmCancelTrigger(gameId: string, seat: number, seq: number): Promise<void>;
  disarmAllCancelTriggers(gameId: string, seat: number): Promise<void>;
  editCancelTrigger(
    gameId: string,
    seat: number,
    seq: number,
    move: string,
    atoms: string[],
    config: CancelTriggerLeechConfig | Record<string, never>
  ): Promise<void>;
  /** The atomic "a match just fired" step (migration 20260815090000's own doc comment explains the
   * race it closes). Returns whether THIS call is the one that actually applied the cancellation -
   * false means another evaluator (another tab's fast-path, or the offline edge function) already
   * got there first, so the caller does nothing further (no toast, no second notice). */
  resolveCancelTriggerMatch(gameId: string, seat: number, reason: string): Promise<boolean>;
}

export type HostedCallbacks = {
  /** Serialized engine JSON, ready for the launcher's "state" event. */
  onState: (engineData: unknown) => void;
  /**
   * The same serialized engine JSON as `onState`, but only for a COMMITTED state - a completed turn
   * (local or remote), a load, or a resync - never a half-composed turn being previewed while the
   * player clicks through it. For consumers that persist or export the game rather than render it
   * (e.g. an offline mirror copy). Fires per state, not per move: a resync that lands several
   * turns at once fires once.
   */
  onCommittedState?: (engineData: any) => void;
  onError?: (message: string) => void;
  /** Refetched on load and whenever a moves row arrives (PREMOVE_PLAN.md §3's refresh rule). */
  onPremoveState?: (premoves: PremoveRow[], failures: PremoveFailureRow[]) => void;
  /** Preference Split Auction: submission progress while the bid phase is open. Progress only -
   * never anybody's points, which is the whole point of the sealed table. */
  onSealedBidState?: (status: SealedBidStatus) => void;
  /** Phase 3 (§10.6) - fired whenever a queued premove is the thing that just played (fast-path
   * success only - the offline edge function's own plays are noticed the same way on the next
   * refresh, since the consumed row simply vanished). Quiet, in-app only: a log tag / subtle toast,
   * never a push (successes don't push - only failures do, via the existing premove_failures infra). */
  onPremovePlayed?: (seat: number, move: string, info: { rank?: number; totalRanks?: number }) => void;
  /** Refetched alongside premoves/failures (same refresh points). */
  onCancelTriggerState?: (triggers: CancelTriggerRow[]) => void;
  /** Fired when THIS session's fast-path is the one that actually applied a cancel-trigger match
   * (resolveCancelTriggerMatch returned true) - the toast (§8.5). The offline edge function's own
   * matches are noticed the same way any premove_failures row is: via onPremoveState. */
  onCancelTriggerFired?: (seat: number, reason: string) => void;
};
