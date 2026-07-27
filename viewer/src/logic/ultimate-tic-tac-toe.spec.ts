import { expect } from "chai";
import {
  EMPTY_ULTIMATE_BOARD,
  isLegalUltimateMove,
  isValidUltimateBoard,
  localUltimatePanelStorageKey,
  localUltimateStorageKey,
  miniBoardResolution,
  parseUltimateLocalState,
  placeUltimateMark,
  ultimateBoardStatus,
  validMiniBoards,
} from "./ultimate-tic-tac-toe";
import {
  evaluateUltimatePosition,
  staticUltimateEvaluation,
  xEvaluationPercent,
} from "./ultimate-tic-tac-toe-evaluation";

function withMarks(board: string, mark: "x" | "o", indices: number[]): string {
  let next = board;
  for (const index of indices) {
    next = next.slice(0, index) + mark + next.slice(index + 1);
  }
  return next;
}

describe("Ultimate tic-tac-toe rules", () => {
  it("allows X anywhere, then routes each move by its cell inside the small board", () => {
    const afterX = placeUltimateMark(EMPTY_ULTIMATE_BOARD, null, 8);
    expect(afterX).to.be.a("string");
    expect(validMiniBoards(afterX!, 8)).to.deep.equal([8]);
    expect(isLegalUltimateMove(afterX!, 8, 0)).to.equal(false);

    const afterO = placeUltimateMark(afterX!, 8, 72);
    expect(afterO?.charAt(72)).to.equal("o");
    expect(validMiniBoards(afterO!, 72)).to.deep.equal([0]);
  });

  it("closes a won small board and grants free placement when a move routes back to it", () => {
    const won = withMarks(EMPTY_ULTIMATE_BOARD, "x", [0, 1, 2]);
    expect(miniBoardResolution(won, 0)).to.equal("x");
    expect(validMiniBoards(won, 9)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(isLegalUltimateMove(won, 9, 3)).to.equal(false);
    expect(isLegalUltimateMove(won, 9, 13)).to.equal(true);
  });

  it("treats a full drawn destination as resolved and grants the same free placement", () => {
    const drawnMini = "xoxxoooxx";
    const board = drawnMini + ".".repeat(72);
    expect(miniBoardResolution(board, 0)).to.equal("draw");
    expect(validMiniBoards(board, 18)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("awards the large board after three owned small boards in a line", () => {
    let board = EMPTY_ULTIMATE_BOARD;
    board = withMarks(board, "x", [0, 1, 2, 9, 10, 11, 18, 19, 20]);
    board = withMarks(board, "o", [27, 28, 30, 31, 33, 34, 36, 37]);
    const status = ultimateBoardStatus(board);
    expect(status.winner).to.equal("x");
    expect(status.over).to.equal(true);
    expect(validMiniBoards(board, 20)).to.deep.equal([]);
  });

  it("draws only when all nine small boards are resolved without a large-board winner", () => {
    const xHeavyDraw = "xoxxoooxx";
    const oHeavyDraw = "oxooxxxoo";
    const board = xHeavyDraw.repeat(5) + oHeavyDraw.repeat(4);
    expect(isValidUltimateBoard(board)).to.equal(true);
    expect(ultimateBoardStatus(board)).to.include({ winner: null, draw: true, over: true });
  });

  it("keeps offline state and face selection isolated by Gaia game", () => {
    expect(localUltimateStorageKey("?offline=1&game=one")).to.equal("lf-ultimate-ttt-state:one");
    expect(localUltimateStorageKey("?offline=1&game=two")).to.equal("lf-ultimate-ttt-state:two");
    expect(localUltimatePanelStorageKey("?game=one", "user/a")).to.equal("lf-ultimate-ttt-panel:one:user%2Fa");

    const board = placeUltimateMark(EMPTY_ULTIMATE_BOARD, null, 4)!;
    expect(parseUltimateLocalState(JSON.stringify({ board, lastMove: 4 }))).to.deep.equal({
      board,
      lastMove: 4,
    });
    expect(parseUltimateLocalState('{"board":"broken"}')).to.equal(null);
  });

  it("produces a bounded offline advantage reading and pins decided games", () => {
    expect(staticUltimateEvaluation(EMPTY_ULTIMATE_BOARD, null)).to.equal(0);
    const opening = evaluateUltimatePosition(EMPTY_ULTIMATE_BOARD, null, {
      maxDepth: 2,
      nodeBudget: 2_000,
    });
    expect(opening.depth).to.be.greaterThan(0);
    expect(opening.nodes).to.be.at.most(2_000);
    expect(opening.xPercent).to.be.within(2, 98);

    let xWin = EMPTY_ULTIMATE_BOARD;
    xWin = withMarks(xWin, "x", [0, 1, 2, 9, 10, 11, 18, 19, 20]);
    const decided = evaluateUltimatePosition(xWin, 20);
    expect(decided.winner).to.equal("x");
    expect(decided.xPercent).to.equal(100);
    expect(xEvaluationPercent(-100, "o")).to.equal(0);
  });
});
