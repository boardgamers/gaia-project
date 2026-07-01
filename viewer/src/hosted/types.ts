// Row shapes mirror supabase/migrations/0001_multiplayer.sql.

export type GameRow = {
  id: string;
  name: string;
  seed: string;
  player_count: number;
  options: Record<string, unknown>;
  status: "active" | "finished";
  current_seat: number | null;
  move_count: number;
};

export type PlayerRow = {
  game_id: string;
  seat: number;
  invited_email: string;
  user_id: string | null;
  display_name: string;
};

export type MoveRow = {
  game_id: string;
  seq: number;
  seat: number;
  move: string;
};

export type CommitTurnArgs = {
  gameId: string;
  seq: number;
  seat: number;
  move: string;
  nextSeat: number | null;
  finished: boolean;
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
