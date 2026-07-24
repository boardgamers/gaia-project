import { Orientation } from "./chess";

export type ChessPanelMode = "pool" | "chess";

export interface ChessRow {
  fen: string;
  white_user: string | null;
  black_user: string | null;
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
  claim(color: Orientation): Promise<void>;
  leave(): Promise<void>;
  move(previousFen: string, nextFen: string): Promise<string>;
  reset(): Promise<void>;
  setPanelMode(mode: ChessPanelMode): Promise<void>;
}
