// Pure, chess.js-agnostic helpers for the shared chess board that lives inside the Lost Fleet
// booster/federation sidebar container (owner request). Real chess rules (legal moves, castling,
// en passant, promotion, check/mate) are owned by chess.js at runtime - this file only holds the
// small, testable glue the Vue component needs: piece glyphs and the board <-> screen orientation
// mapping (so each player sees their own pieces at the bottom, like a real board).

// Standard opening position, in Forsyth-Edwards Notation.
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// A chess.js piece: { type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' }, or null for an empty square.
export interface ChessPiece {
  type: string;
  color: string;
}
export type Cell = ChessPiece | null;
// chess.js `.board()` shape: 8 ranks (index 0 = rank 8) x 8 files (index 0 = file a).
export type BoardMatrix = Cell[][];

export type Orientation = "w" | "b";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const LOCAL_CHESS_KEY_PREFIX = "lf-chess-fen:";
const LOCAL_CHESS_PANEL_KEY_PREFIX = "lf-chess-panel:";

function localGameStorageSuffix(search: string): string {
  const gameId = new URLSearchParams(search).get("game");
  return gameId ? encodeURIComponent(gameId) : "sandbox";
}

// Offline games already have stable ids in `?offline=1&game=...`; use that id so every Gaia game
// gets an independent pass-and-play chess position. The plain self-contained viewer has no game id,
// so it deliberately shares one local sandbox instead.
export function localChessStorageKey(search = ""): string {
  return `${LOCAL_CHESS_KEY_PREFIX}${localGameStorageSuffix(search)}`;
}

// The selected sidebar face is also local to one offline Gaia game. Hosted games store this on
// their shared chess row instead, so every connected viewer receives the same mode over Realtime.
export function localChessPanelStorageKey(search = ""): string {
  return `${LOCAL_CHESS_PANEL_KEY_PREFIX}${localGameStorageSuffix(search)}`;
}

// Online players keep their own colour at the bottom. Offline is pass-and-play on one device, so
// the board flips after every completed move to put the new side to move at the bottom.
export function boardOrientation(online: boolean, myColor: Orientation | null, turn: Orientation): Orientation {
  return online ? myColor ?? "w" : turn;
}

const GLYPHS: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

// The filled unicode glyph for a piece (colour is applied via CSS, not the glyph itself).
export function pieceGlyph(piece: Cell): string {
  if (!piece) {
    return "";
  }
  return GLYPHS[piece.type] ?? "";
}

// One square in screen order, with its algebraic name so clicks map straight back to chess.js.
export interface DisplaySquare {
  /** Algebraic name, e.g. "e4" - what chess.js `move`/`moves` use. */
  square: string;
  piece: Cell;
  /** true for the light-coloured squares. */
  light: boolean;
}

// Flatten chess.js's `board()` matrix into 64 squares in the on-screen reading order (top-left to
// bottom-right), oriented so the given colour's back rank is at the BOTTOM - White orientation shows
// rank 8 on top / file a on the left; Black orientation flips both axes so Black sits at the bottom.
export function displaySquares(board: BoardMatrix, orientation: Orientation): DisplaySquare[] {
  const cells: DisplaySquare[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // board[boardRow][boardCol]: boardRow 0 = rank 8, boardCol 0 = file a.
      const boardRow = orientation === "w" ? row : 7 - row;
      const boardCol = orientation === "w" ? col : 7 - col;
      const rankNumber = 8 - boardRow; // 8..1
      cells.push({
        square: FILES[boardCol] + rankNumber,
        piece: board[boardRow][boardCol],
        // a8 (top-left in White orientation) is a light square; parity of file+rank sets the rest.
        light: (boardRow + boardCol) % 2 === 0,
      });
    }
  }
  return cells;
}

// The rank a pawn of the given colour promotes on ("8" for White, "1" for Black) - used to know
// when a pawn move needs a promotion choice before it is sent to chess.js.
export function promotionRank(color: Orientation): string {
  return color === "w" ? "8" : "1";
}
