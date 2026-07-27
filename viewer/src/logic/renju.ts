// Pure, framework-agnostic rules for the shared renju (gomoku) board that lives inside the research
// board's swipe drawer - the same split logic/chess.ts uses for the sidebar chess face. Unlike
// chess, there is no third-party rules engine here: five-in-a-row is small enough to own outright,
// which also keeps the offline bundle unchanged.
//
// Rule set: STANDARD GOMOKU (owner choice). Stones are placed on the 15x15 grid's intersections,
// black moves first, and a line of EXACTLY five wins - an overline of six or more does not win, for
// either colour. (Free-style gomoku would count 6+ as a win; true renju would additionally forbid
// black's double-three/double-four - neither is what this board plays.)

export const RENJU_SIZE = 15;
export const RENJU_CELLS = RENJU_SIZE * RENJU_SIZE;
export const EMPTY_RENJU_BOARD = ".".repeat(RENJU_CELLS);

export type Stone = "b" | "w";

// The traditional 15x15 star points (tengen plus the four 4-4 handicap points), drawn as small dots.
export const RENJU_STAR_POINTS: number[] = [
  3 * RENJU_SIZE + 3,
  3 * RENJU_SIZE + 11,
  7 * RENJU_SIZE + 7,
  11 * RENJU_SIZE + 3,
  11 * RENJU_SIZE + 11,
];

const LOCAL_RENJU_KEY_PREFIX = "lf-renju-state:";
const LOCAL_RENJU_PANEL_KEY_PREFIX = "lf-renju-panel:";

function localGameStorageSuffix(search: string): string {
  const gameId = new URLSearchParams(search).get("game");
  return gameId ? encodeURIComponent(gameId) : "sandbox";
}

// Mirrors logic/chess.ts: offline games carry a stable `?game=` id, so each one keeps its own
// pass-and-play position; the plain self-contained viewer shares one local sandbox.
export function localRenjuStorageKey(search = ""): string {
  return `${LOCAL_RENJU_KEY_PREFIX}${localGameStorageSuffix(search)}`;
}

// The research panel's visible face, per Gaia game and per account - see
// logic/chess.ts::localChessPanelStorageKey for why this is deliberately local rather than shared.
export function localRenjuPanelStorageKey(search = "", userId: string | null = null): string {
  const account = userId ? `:${encodeURIComponent(userId)}` : "";
  return `${LOCAL_RENJU_PANEL_KEY_PREFIX}${localGameStorageSuffix(search)}${account}`;
}

export function rowOf(index: number): number {
  return Math.floor(index / RENJU_SIZE);
}

export function columnOf(index: number): number {
  return index % RENJU_SIZE;
}

export function stoneAt(board: string, index: number): Stone | null {
  const value = board.charAt(index);
  return value === "b" || value === "w" ? value : null;
}

/**
 * A board string is 225 characters of `.`/`b`/`w` whose stone counts are consistent with black
 * moving first. The database re-checks the same shape, so an out-of-range or tampered board can
 * never be committed by a client that skipped this.
 */
export function isValidBoard(board: string): boolean {
  if (typeof board !== "string" || board.length !== RENJU_CELLS || !/^[.bw]*$/.test(board)) {
    return false;
  }
  const black = countStones(board, "b");
  const white = countStones(board, "w");
  return black - white === 0 || black - white === 1;
}

export function countStones(board: string, stone: Stone): number {
  let total = 0;
  for (let index = 0; index < board.length; index++) {
    if (board.charAt(index) === stone) {
      total++;
    }
  }
  return total;
}

/** Black opens, so it is black's turn whenever both colours have played the same number of stones. */
export function turnFor(board: string): Stone {
  return countStones(board, "b") === countStones(board, "w") ? "b" : "w";
}

/** The board with `stone` added at `index`, or null when that placement isn't legal. */
export function placeStone(board: string, index: number, stone: Stone): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= RENJU_CELLS || board.charAt(index) !== ".") {
    return null;
  }
  return board.slice(0, index) + stone + board.slice(index + 1);
}

const DIRECTIONS: [number, number][] = [
  [1, 0], // -
  [0, 1], // |
  [1, 1], // \
  [1, -1], // /
];

// Walk from `index` along one direction while the same colour continues, stopping at the board edge.
// Column arithmetic is explicit so a run can never wrap from the last column into the next row.
function runLength(board: string, index: number, stone: Stone, dx: number, dy: number): number[] {
  const line: number[] = [];
  let column = columnOf(index) + dx;
  let row = rowOf(index) + dy;
  while (column >= 0 && column < RENJU_SIZE && row >= 0 && row < RENJU_SIZE) {
    const next = row * RENJU_SIZE + column;
    if (board.charAt(next) !== stone) {
      break;
    }
    line.push(next);
    column += dx;
    row += dy;
  }
  return line;
}

/**
 * The five indices of the winning line through the stone just played at `index`, or null.
 *
 * Standard gomoku: the run must be EXACTLY five. A six-or-longer overline is explicitly not a win,
 * so a player who extends their own five into a six has not won with it.
 */
export function winningLine(board: string, index: number): number[] | null {
  const stone = stoneAt(board, index);
  if (!stone) {
    return null;
  }
  for (const [dx, dy] of DIRECTIONS) {
    const before = runLength(board, index, stone, -dx, -dy);
    const after = runLength(board, index, stone, dx, dy);
    if (before.length + after.length + 1 === 5) {
      return [...before.reverse(), index, ...after];
    }
  }
  return null;
}

export function isDraw(board: string): boolean {
  return board.indexOf(".") === -1;
}

export interface RenjuStatus {
  /** The colour that has won, or null while the game is live (or drawn). */
  winner: Stone | null;
  /** The five winning intersections, for the line drawn across the board. */
  line: number[];
  draw: boolean;
  over: boolean;
}

/**
 * The status of a position. A win is always the consequence of the LAST stone played, which is why
 * the caller passes it - scanning the whole board would also report a five that an overline has
 * since grown past.
 */
export function boardStatus(board: string, lastMove: number | null): RenjuStatus {
  const line = lastMove === null || lastMove < 0 ? null : winningLine(board, lastMove);
  if (line) {
    return { winner: stoneAt(board, lastMove), line, draw: false, over: true };
  }
  const draw = isDraw(board);
  return { winner: null, line: [], draw, over: draw };
}

export interface RenjuLocalState {
  board: string;
  lastMove: number | null;
}

/** Offline pass-and-play persistence: one JSON blob per Gaia game, tolerant of anything stale. */
export function parseLocalState(raw: string | null): RenjuLocalState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !isValidBoard(parsed.board)) {
      return null;
    }
    const lastMove =
      Number.isInteger(parsed.lastMove) && parsed.lastMove >= 0 && parsed.lastMove < RENJU_CELLS
        ? parsed.lastMove
        : null;
    return { board: parsed.board, lastMove };
  } catch {
    return null;
  }
}
