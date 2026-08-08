// Pure rules and local persistence helpers for Ultimate tic-tac-toe. The board is serialized as
// nine consecutive 3x3 boards (81 characters total): mini board 0 occupies characters 0..8, mini
// board 1 occupies 9..17, and so on. That layout makes the routing rule deliberately explicit:
// `cellWithinMini(lastMove)` is the mini board the next player must enter, unless it is resolved.

export const ULTIMATE_MINI_CELLS = 9;
export const ULTIMATE_CELLS = 81;
export const EMPTY_ULTIMATE_BOARD = ".".repeat(ULTIMATE_CELLS);

export type UltimateMark = "x" | "o";
export type MiniResolution = UltimateMark | "draw" | null;

export const ULTIMATE_WIN_LINES: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const LOCAL_STATE_KEY_PREFIX = "lf-ultimate-ttt-state:";
const LOCAL_PANEL_KEY_PREFIX = "lf-ultimate-ttt-panel:";

function localGameStorageSuffix(search: string): string {
  const gameId = new URLSearchParams(search).get("game");
  return gameId ? encodeURIComponent(gameId) : "sandbox";
}

export function localUltimateStorageKey(search = ""): string {
  return `${LOCAL_STATE_KEY_PREFIX}${localGameStorageSuffix(search)}`;
}

export function localUltimatePanelStorageKey(search = "", userId: string | null = null): string {
  const account = userId ? `:${encodeURIComponent(userId)}` : "";
  return `${LOCAL_PANEL_KEY_PREFIX}${localGameStorageSuffix(search)}${account}`;
}

export function miniBoardOf(index: number): number {
  return Math.floor(index / ULTIMATE_MINI_CELLS);
}

export function cellWithinMini(index: number): number {
  return index % ULTIMATE_MINI_CELLS;
}

export function ultimateCellIndex(miniBoard: number, cell: number): number {
  return miniBoard * ULTIMATE_MINI_CELLS + cell;
}

export function markAt(board: string, index: number): UltimateMark | null {
  const value = board.charAt(index);
  return value === "x" || value === "o" ? value : null;
}

export function countMarks(board: string, mark: UltimateMark): number {
  let count = 0;
  for (let index = 0; index < board.length; index++) {
    if (board.charAt(index) === mark) {
      count++;
    }
  }
  return count;
}

export function turnForUltimateBoard(board: string): UltimateMark {
  return countMarks(board, "x") === countMarks(board, "o") ? "x" : "o";
}

export function isValidUltimateBoard(board: string): boolean {
  if (typeof board !== "string" || board.length !== ULTIMATE_CELLS || !/^[.xo]+$/.test(board)) {
    return false;
  }
  const x = countMarks(board, "x");
  const o = countMarks(board, "o");
  return x === o || x === o + 1;
}

function winnerOfNine(cells: Array<UltimateMark | null>): UltimateMark | null {
  for (const [a, b, c] of ULTIMATE_WIN_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

export function miniBoardWinner(board: string, miniBoard: number): UltimateMark | null {
  const cells = Array.from({ length: ULTIMATE_MINI_CELLS }, (_, cell) =>
    markAt(board, ultimateCellIndex(miniBoard, cell))
  );
  return winnerOfNine(cells);
}

export function miniBoardResolution(board: string, miniBoard: number): MiniResolution {
  const winner = miniBoardWinner(board, miniBoard);
  if (winner) {
    return winner;
  }
  for (let cell = 0; cell < ULTIMATE_MINI_CELLS; cell++) {
    if (!markAt(board, ultimateCellIndex(miniBoard, cell))) {
      return null;
    }
  }
  return "draw";
}

export function miniBoardResolutions(board: string): MiniResolution[] {
  return Array.from({ length: ULTIMATE_MINI_CELLS }, (_, miniBoard) => miniBoardResolution(board, miniBoard));
}

export function ultimateWinner(board: string): UltimateMark | null {
  const owners = miniBoardResolutions(board).map((resolution) =>
    resolution === "x" || resolution === "o" ? resolution : null
  );
  return winnerOfNine(owners);
}

export interface UltimateBoardStatus {
  winner: UltimateMark | null;
  draw: boolean;
  over: boolean;
  resolutions: MiniResolution[];
}

export function ultimateBoardStatus(board: string): UltimateBoardStatus {
  const resolutions = miniBoardResolutions(board);
  const owners = resolutions.map((resolution) => (resolution === "x" || resolution === "o" ? resolution : null));
  const winner = winnerOfNine(owners);
  const draw = !winner && resolutions.every((resolution) => resolution !== null);
  return { winner, draw, over: !!winner || draw, resolutions };
}

/**
 * The forced mini board for the next move. `null` means free placement: the opening move, or a
 * route into a mini board that is already won/full.
 */
export function forcedMiniBoard(board: string, lastMove: number | null): number | null {
  if (lastMove === null || lastMove < 0 || lastMove >= ULTIMATE_CELLS) {
    return null;
  }
  const target = cellWithinMini(lastMove);
  return miniBoardResolution(board, target) === null ? target : null;
}

export function validMiniBoards(board: string, lastMove: number | null): number[] {
  const status = ultimateBoardStatus(board);
  if (status.over) {
    return [];
  }
  const forced = forcedMiniBoard(board, lastMove);
  if (forced !== null) {
    return [forced];
  }
  return status.resolutions
    .map((resolution, miniBoard) => (resolution === null ? miniBoard : -1))
    .filter((miniBoard) => miniBoard >= 0);
}

export function isLegalUltimateMove(board: string, lastMove: number | null, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= ULTIMATE_CELLS || markAt(board, index) !== null) {
    return false;
  }
  return validMiniBoards(board, lastMove).indexOf(miniBoardOf(index)) !== -1;
}

export function legalUltimateMoves(board: string, lastMove: number | null): number[] {
  const valid = new Set(validMiniBoards(board, lastMove));
  if (valid.size === 0) {
    return [];
  }
  const moves: number[] = [];
  for (let index = 0; index < ULTIMATE_CELLS; index++) {
    if (valid.has(miniBoardOf(index)) && markAt(board, index) === null) {
      moves.push(index);
    }
  }
  return moves;
}

/** Add the side to move at `index`, or return null when the route/cell is illegal. */
export function placeUltimateMark(board: string, lastMove: number | null, index: number): string | null {
  if (!isLegalUltimateMove(board, lastMove, index)) {
    return null;
  }
  const mark = turnForUltimateBoard(board);
  return board.slice(0, index) + mark + board.slice(index + 1);
}

export interface UltimateLocalState {
  board: string;
  lastMove: number | null;
}

/** Offline pass-and-play persistence, deliberately tolerant of stale or malformed browser data. */
export function parseUltimateLocalState(raw: string | null): UltimateLocalState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !isValidUltimateBoard(parsed.board)) {
      return null;
    }
    const lastMove =
      Number.isInteger(parsed.lastMove) &&
      parsed.lastMove >= 0 &&
      parsed.lastMove < ULTIMATE_CELLS &&
      markAt(parsed.board, parsed.lastMove)
        ? parsed.lastMove
        : null;
    return { board: parsed.board, lastMove };
  } catch {
    return null;
  }
}
