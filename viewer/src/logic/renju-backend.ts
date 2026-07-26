/* eslint-disable @typescript-eslint/camelcase */
// Supabase row/RPC wire names are snake_case.
export type RenjuPanelMode = "research" | "renju";

export interface RenjuRow {
  board: string;
  last_move: number | null;
  updated_at?: string;
  black_user: string | null;
  black_user_2: string | null;
  white_user: string | null;
  white_user_2: string | null;
  black_next_user: string | null;
  white_next_user: string | null;
  panel_mode: RenjuPanelMode;
}

/**
 * The per-game persistence boundary used by RenjuBoard.vue and ResearchPanel.vue - the exact same
 * shape as ChessBackend, for the same reason: hosted mode injects a Supabase-backed implementation
 * into the viewer store, while self-contained and offline pass-and-play leave it null and fall back
 * to a per-game localStorage key, so the components never import Supabase and never attempt a
 * network request offline.
 */
export interface RenjuBackend {
  readonly gameId: string;
  readonly userId: string;
  load(): Promise<RenjuRow | null>;
  subscribe(onRow: (row: RenjuRow) => void): () => void;
  /** Returns the board actually stored, which differs from `nextBoard` if someone moved first. */
  move(previousBoard: string, nextBoard: string, index: number): Promise<string>;
  reset(): Promise<void>;
  setPanelMode(mode: RenjuPanelMode): Promise<RenjuRow | null>;
}
