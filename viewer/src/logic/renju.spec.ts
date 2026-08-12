import { expect } from "chai";
import {
  EMPTY_RENJU_BOARD,
  RENJU_CELLS,
  RENJU_SIZE,
  boardStatus,
  countStones,
  isDraw,
  isValidBoard,
  localRenjuPanelStorageKey,
  localRenjuStorageKey,
  moveIndexOrNull,
  otherColorLastMove,
  parseLocalState,
  placeStone,
  turnFor,
  winningLine,
} from "./renju";

// Helper: build a board from a list of [index, stone] placements.
function boardWith(...placements: [number, "b" | "w"][]): string {
  let board = EMPTY_RENJU_BOARD;
  for (const [index, stone] of placements) {
    board = board.slice(0, index) + stone + board.slice(index + 1);
  }
  return board;
}

function at(row: number, column: number): number {
  return row * RENJU_SIZE + column;
}

// A run of `length` stones starting at (row, column) and stepping by (dRow, dColumn).
function run(row: number, column: number, dRow: number, dColumn: number, length: number, stone: "b" | "w" = "b") {
  const placements: [number, "b" | "w"][] = [];
  for (let i = 0; i < length; i++) {
    placements.push([at(row + dRow * i, column + dColumn * i), stone]);
  }
  return placements;
}

describe("renju", () => {
  it("starts empty, with black to move", () => {
    expect(EMPTY_RENJU_BOARD).to.have.length(RENJU_CELLS);
    expect(turnFor(EMPTY_RENJU_BOARD)).to.equal("b");
    expect(isDraw(EMPTY_RENJU_BOARD)).to.equal(false);
  });

  it("alternates the turn by stone count", () => {
    const afterBlack = placeStone(EMPTY_RENJU_BOARD, at(7, 7), "b");
    expect(turnFor(afterBlack)).to.equal("w");
    expect(turnFor(placeStone(afterBlack, at(7, 8), "w"))).to.equal("b");
  });

  it("refuses a stone on an occupied or out-of-range intersection", () => {
    const board = placeStone(EMPTY_RENJU_BOARD, at(3, 3), "b");
    expect(placeStone(board, at(3, 3), "w")).to.equal(null);
    expect(placeStone(board, -1, "w")).to.equal(null);
    expect(placeStone(board, RENJU_CELLS, "w")).to.equal(null);
    expect(countStones(board, "b")).to.equal(1);
  });

  it("detects exactly five in every direction", () => {
    const cases: Record<string, [number, number]> = {
      horizontal: [0, 1],
      vertical: [1, 0],
      "diagonal down-right": [1, 1],
      "diagonal up-right": [-1, 1],
    };
    for (const [name, [dRow, dColumn]] of Object.entries(cases)) {
      const startRow = dRow < 0 ? 8 : 4;
      const placements = run(startRow, 4, dRow, dColumn, 5);
      const board = boardWith(...placements);
      const line = winningLine(board, placements[2][0]);
      expect(line, `${name} should win`).to.not.equal(null);
      expect(line).to.have.length(5);
      // Reported in line order, so the board can draw a stroke from end to end.
      expect(line![0]).to.equal(placements[0][0]);
      expect(line![4]).to.equal(placements[4][0]);
    }
  });

  it("does not treat four, or an overline of six, as a win (standard gomoku)", () => {
    const four = boardWith(...run(7, 3, 0, 1, 4));
    expect(winningLine(four, at(7, 3))).to.equal(null);

    const six = boardWith(...run(7, 3, 0, 1, 6));
    for (let column = 3; column < 9; column++) {
      expect(winningLine(six, at(7, column)), `overline stone at column ${column}`).to.equal(null);
    }
  });

  it("never counts a run that wraps around a board edge", () => {
    // Three stones at the end of row 5 and two at the start of row 6 are adjacent by raw index but
    // are not a line on the board. Anchored to the board's real width, so this keeps straddling the
    // edge if RENJU_SIZE ever changes again.
    const edge = RENJU_SIZE - 1;
    const board = boardWith(
      [at(5, edge - 2), "b"],
      [at(5, edge - 1), "b"],
      [at(5, edge), "b"],
      [at(6, 0), "b"],
      [at(6, 1), "b"]
    );
    expect(winningLine(board, at(5, edge))).to.equal(null);
    expect(winningLine(board, at(6, 0))).to.equal(null);
  });

  it("ignores a five belonging to the other colour", () => {
    const board = boardWith(...run(2, 2, 0, 1, 5, "w"));
    expect(winningLine(board, at(2, 4))!.length).to.equal(5);
    const mixed = boardWith(...run(2, 2, 0, 1, 4, "w"), [at(2, 6), "b"]);
    expect(winningLine(mixed, at(2, 6))).to.equal(null);
  });

  it("reports status from the last stone played", () => {
    const board = boardWith(...run(9, 1, 1, 1, 5, "w"));
    const status = boardStatus(board, at(11, 3));
    expect(status.winner).to.equal("w");
    expect(status.over).to.equal(true);
    expect(status.line).to.have.length(5);

    const live = boardStatus(placeStone(EMPTY_RENJU_BOARD, at(7, 7), "b")!, at(7, 7));
    expect(live.winner).to.equal(null);
    expect(live.over).to.equal(false);
    expect(boardStatus(EMPTY_RENJU_BOARD, null).over).to.equal(false);
  });

  it("reports a full board as a draw", () => {
    // Fill the board with a pattern that never makes five in a row: pairs of colours in a repeating
    // bbww cycle down the index space.
    let board = "";
    for (let index = 0; index < RENJU_CELLS; index++) {
      board += "bbww".charAt(index % 4);
    }
    const status = boardStatus(board, null);
    expect(isDraw(board)).to.equal(true);
    expect(status.draw).to.equal(true);
    expect(status.over).to.equal(true);
    expect(status.winner).to.equal(null);
  });

  it("validates board strings before they are trusted", () => {
    expect(isValidBoard(EMPTY_RENJU_BOARD)).to.equal(true);
    expect(isValidBoard("bw")).to.equal(false);
    expect(isValidBoard("x".repeat(RENJU_CELLS))).to.equal(false);
    // White may never be ahead, and black by at most one.
    expect(isValidBoard(boardWith([0, "w"]))).to.equal(false);
    expect(isValidBoard(boardWith([0, "b"], [1, "b"]))).to.equal(false);
    expect(isValidBoard(boardWith([0, "b"], [1, "w"]))).to.equal(true);
  });

  it("accepts only in-range move indices", () => {
    expect(moveIndexOrNull(0)).to.equal(0);
    expect(moveIndexOrNull(RENJU_CELLS - 1)).to.equal(RENJU_CELLS - 1);
    expect(moveIndexOrNull(RENJU_CELLS)).to.equal(null);
    expect(moveIndexOrNull(-1)).to.equal(null);
    expect(moveIndexOrNull(1.5)).to.equal(null);
    expect(moveIndexOrNull(null)).to.equal(null);
    expect(moveIndexOrNull("7")).to.equal(null);
  });

  it("marks the other colour's latest stone only when it really is the other colour", () => {
    const board = boardWith([at(7, 7), "b"], [at(7, 8), "w"], [at(3, 3), "b"]);
    // The stone before the last one belongs to the other side: mark it.
    expect(otherColorLastMove(board, at(7, 8), at(7, 7))).to.equal(at(7, 7));
    // Two black moves - a realtime update was missed, so white's latest is unknown.
    expect(otherColorLastMove(board, at(3, 3), at(7, 7))).to.equal(null);
    // Nothing to compare against, or the candidate points at an empty intersection (post-reset).
    expect(otherColorLastMove(board, at(7, 8), null)).to.equal(null);
    expect(otherColorLastMove(board, null, at(7, 7))).to.equal(null);
    expect(otherColorLastMove(board, at(7, 8), at(0, 0))).to.equal(null);
    expect(otherColorLastMove(board, at(7, 8), at(7, 8))).to.equal(null);
  });

  it("parses only sane local state, including both markers", () => {
    const board = boardWith([at(7, 7), "b"], [at(7, 8), "w"]);
    expect(parseLocalState(JSON.stringify({ board, lastMove: at(7, 8), prevMove: at(7, 7) }))).to.deep.equal({
      board,
      lastMove: at(7, 8),
      prevMove: at(7, 7),
    });
    // A blob written before the second marker existed, and a nonsense one.
    expect(parseLocalState(JSON.stringify({ board, lastMove: at(7, 8) }))).to.deep.equal({
      board,
      lastMove: at(7, 8),
      prevMove: null,
    });
    expect(parseLocalState(JSON.stringify({ board, lastMove: 9999, prevMove: 9999 }))).to.deep.equal({
      board,
      lastMove: null,
      prevMove: null,
    });
    expect(parseLocalState(JSON.stringify({ board: "nope", lastMove: 1 }))).to.equal(null);
    expect(parseLocalState("{not json")).to.equal(null);
    expect(parseLocalState(null)).to.equal(null);
  });

  it("keeps one stored position per offline game", () => {
    expect(localRenjuStorageKey("?offline=1&game=abc")).to.not.equal(localRenjuStorageKey("?offline=1&game=def"));
    expect(localRenjuStorageKey("")).to.contain("sandbox");
    expect(localRenjuPanelStorageKey("?game=abc")).to.not.equal(localRenjuStorageKey("?game=abc"));
  });
});
