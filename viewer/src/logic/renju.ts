// Pure, framework-agnostic rules for the shared renju (gomoku) board that lives inside the research
// board's swipe drawer - the same split logic/chess.ts uses for the sidebar chess face. Unlike
// chess, there is no third-party rules engine here: five-in-a-row is small enough to own outright,
// which also keeps the offline bundle unchanged.
//
// Rule set: STANDARD GOMOKU (owner choice). Stones are placed on the 19x19 grid's intersections,
// black moves first, and a line of EXACTLY five wins - an overline of six or more does not win, for
// either colour. (Free-style gomoku would count 6+ as a win; true renju would additionally forbid
// black's double-three/double-four - neither is what this board plays.)
//
// The grid was 15x15 (the gomoku tournament size) until 2026-08-12, when the owner asked for a full
// 19x19 Go board instead. Everything downstream - the engine, the SVG, win detection - is written
// against RENJU_SIZE, so this constant is the change; the database's own board string is sized to
// match by migration 20260812120000_renju_19x19.sql, which also re-centres positions that were
// already in progress on the smaller grid.

export const RENJU_SIZE = 19;
export const RENJU_CELLS = RENJU_SIZE * RENJU_SIZE;
export const EMPTY_RENJU_BOARD = ".".repeat(RENJU_CELLS);

export type Stone = "b" | "w";

// The 19x19 board's nine star points (tengen plus the eight 4-4/4-10 handicap points), drawn as
// small dots - the standard Go layout, since this is now a Go-sized board.
export const RENJU_STAR_POINTS: number[] = [
  3 * RENJU_SIZE + 3,
  3 * RENJU_SIZE + 9,
  3 * RENJU_SIZE + 15,
  9 * RENJU_SIZE + 3,
  9 * RENJU_SIZE + 9,
  9 * RENJU_SIZE + 15,
  15 * RENJU_SIZE + 3,
  15 * RENJU_SIZE + 9,
  15 * RENJU_SIZE + 15,
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

/** An intersection index from any untrusted source (a database row, a stale localStorage blob). */
export function moveIndexOrNull(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < RENJU_CELLS
    ? (value as number)
    : null;
}

/**
 * The intersection to mark for the colour that did NOT play `lastMove` - i.e. the other side's own
 * most recent stone, so both players can see where they each played last.
 *
 * `candidate` is whatever the caller believes that move was (the persisted `prev_move`, or the move
 * it was showing before the position changed). It is only accepted when it really holds a stone of
 * the opposite colour: after a reset it points at an empty intersection, and if two stones arrived
 * at once - a realtime update missed while the tab slept - it is the same colour as `lastMove` and
 * the other side's latest move is genuinely unknown. Both cases return null rather than a lie.
 */
export function otherColorLastMove(board: string, lastMove: number | null, candidate: number | null): number | null {
  if (lastMove === null || candidate === null || candidate === lastMove) {
    return null;
  }
  const last = stoneAt(board, lastMove);
  const other = stoneAt(board, candidate);
  return last && other && last !== other ? candidate : null;
}

/**
 * A board string is RENJU_CELLS characters of `.`/`b`/`w` whose stone counts are consistent with
 * black moving first. The database re-checks the same shape, so an out-of-range or tampered board
 * can never be committed by a client that skipped this. A 225-character position from before the
 * 19x19 change therefore reads as invalid here - the migration converts every stored one, so the
 * only way to meet one is a client running ahead of the database.
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
  /** The other colour's latest stone, so both last moves survive an offline reload. */
  prevMove: number | null;
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
    const lastMove = moveIndexOrNull(parsed.lastMove);
    return {
      board: parsed.board,
      lastMove,
      // Blobs written before both markers existed simply have no prevMove.
      prevMove: otherColorLastMove(parsed.board, lastMove, moveIndexOrNull(parsed.prevMove)),
    };
  } catch {
    return null;
  }
}
