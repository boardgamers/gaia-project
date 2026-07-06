// Row shapes mirror supabase/migrations/0001_multiplayer.sql (current_round/faction/score added
// in 0009_lobby_round_faction_score_cache.sql).

export type GameRow = {
  id: string;
  name: string;
  seed: string;
  player_count: number;
  options: Record<string, unknown>;
  status: "active" | "finished";
  current_seat: number | null;
  move_count: number;
  // Cached lobby-list display data - null until this game's first post-migration commit (see the
  // migration's own doc comment). Never read by game logic, only the Lobby row.
  current_round: number | null;
};

export type PlayerRow = {
  game_id: string;
  seat: number;
  invited_email: string;
  user_id: string | null;
  display_name: string;
  faction: string | null;
  score: number | null;
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
  playerUpdates: PlayerUpdate[];
};

// Premove (PREMOVE_PLAN.md, Phase 1) - RLS already scopes selects to the caller's own seats, so
// fetches don't take a seat filter; queue/cancel take an explicit seat since a multi-seat owner is
// never ambiguous (see the RPCs in 0010_premoves.sql).
// Phase 3 (§10.1-10.4) added `mode` - all of a seat's rows share one mode; `seq` means turn-order in
// sequential mode, priority-rank in priority mode.
export type PremoveMode = "sequential" | "priority";
export type PremoveRow = { seat: number; seq: number; move: string; mode: PremoveMode; queued_move_count: number };
export type PremoveFailureRow = { id: string; seat: number; move: string; reason: string; read_at: string | null };

// The data layer the game host needs. Implemented for real over supabase-js
// in supabase-client.ts and faked in host.spec.ts.
export interface HostedBackend {
  fetchGame(gameId: string): Promise<GameRow>;
  fetchPlayers(gameId: string): Promise<PlayerRow[]>;
  fetchMoves(gameId: string): Promise<MoveRow[]>;
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
}

export type HostedCallbacks = {
  /** Serialized engine JSON, ready for the launcher's "state" event. */
  onState: (engineData: unknown) => void;
  onError?: (message: string) => void;
  /** Refetched on load and whenever a moves row arrives (PREMOVE_PLAN.md §3's refresh rule). */
  onPremoveState?: (premoves: PremoveRow[], failures: PremoveFailureRow[]) => void;
  /** Phase 3 (§10.6) - fired whenever a queued premove is the thing that just played (fast-path
   * success only - the offline edge function's own plays are noticed the same way on the next
   * refresh, since the consumed row simply vanished). Quiet, in-app only: a log tag / subtle toast,
   * never a push (successes don't push - only failures do, via the existing premove_failures infra). */
  onPremovePlayed?: (seat: number, move: string, info: { rank?: number; totalRanks?: number }) => void;
};
