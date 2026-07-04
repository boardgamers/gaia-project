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

// The data layer the game host needs. Implemented for real over supabase-js
// in supabase-client.ts and faked in host.spec.ts.
export interface HostedBackend {
  fetchGame(gameId: string): Promise<GameRow>;
  fetchPlayers(gameId: string): Promise<PlayerRow[]>;
  fetchMoves(gameId: string): Promise<MoveRow[]>;
  commitTurn(args: CommitTurnArgs): Promise<void>;
}

export type HostedCallbacks = {
  /** Serialized engine JSON, ready for the launcher's "state" event. */
  onState: (engineData: unknown) => void;
  onError?: (message: string) => void;
};
