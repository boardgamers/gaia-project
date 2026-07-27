/* eslint-disable @typescript-eslint/camelcase */

export type UltimatePanelMode = "ships" | "ultimate";

export interface UltimateTicTacToeRow {
  board: string;
  last_move: number | null;
  updated_at?: string;
  x_user: string | null;
  x_user_2: string | null;
  o_user: string | null;
  o_user_2: string | null;
  x_next_user: string | null;
  o_next_user: string | null;
}

/**
 * Hosted mode injects this per-game boundary. Self-contained/offline stores leave it null, and the
 * board uses localStorage pass-and-play without importing Supabase or attempting a network request.
 */
export interface UltimateTicTacToeBackend {
  readonly gameId: string;
  readonly userId: string;
  load(): Promise<UltimateTicTacToeRow | null>;
  subscribe(onRow: (row: UltimateTicTacToeRow) => void): () => void;
  /** Returns the board actually stored, which differs from `nextBoard` after a concurrent move. */
  move(previousBoard: string, nextBoard: string, index: number): Promise<string>;
  reset(): Promise<void>;
}
