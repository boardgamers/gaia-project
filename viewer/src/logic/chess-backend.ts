/* eslint-disable @typescript-eslint/camelcase */
// Supabase row/RPC wire names are snake_case.
export type ChessPanelMode = "pool" | "chess";

export interface ChessRow {
  fen: string;
  updated_at?: string;
  last_move_from?: string | null;
  last_move_to?: string | null;
  white_user: string | null;
  white_user_2: string | null;
  black_user: string | null;
  black_user_2: string | null;
  white_next_user: string | null;
  black_next_user: string | null;
  panel_mode: ChessPanelMode;
}

/**
 * The small per-game persistence boundary used by ChessBoard.vue.
 *
 * Hosted mode injects a Supabase-backed implementation into the viewer store. Self-contained and
 * offline pass-and-play leave it null and persist to a per-game localStorage key instead, keeping
 * the generic board component independent of Supabase and avoiding any network attempt offline.
 */
export interface ChessBackend {
  readonly gameId: string;
  readonly userId: string;
  load(): Promise<ChessRow | null>;
  subscribe(onRow: (row: ChessRow) => void): () => void;
  move(previousFen: string, nextFen: string, from: string, to: string): Promise<string>;
  reset(): Promise<void>;
  setPanelMode(mode: ChessPanelMode): Promise<ChessRow | null>;
}
