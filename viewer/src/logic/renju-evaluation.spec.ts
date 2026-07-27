import { expect } from "chai";
import { EMPTY_RENJU_BOARD, RENJU_SIZE, placeStone } from "./renju";
import {
  decidedEvaluation,
  evaluationDescription,
  RenjuEvaluation,
  RenjuEvaluator,
  sideToMoveFor,
  whiteEvaluationPercent,
} from "./renju-evaluation";
import { BLACK, WHITE } from "./renju-engine";

function board(black: [number, number][], white: [number, number][] = []): string {
  let result = EMPTY_RENJU_BOARD;
  for (const [row, column] of black) {
    result = placeStone(result, row * RENJU_SIZE + column, "b") as string;
  }
  for (const [row, column] of white) {
    result = placeStone(result, row * RENJU_SIZE + column, "w") as string;
  }
  return result;
}

function evaluation(overrides: Partial<RenjuEvaluation> = {}): RenjuEvaluation {
  return { score: 0, depth: 4, winner: null, winInPlies: null, whitePercent: 50, ...overrides };
}

/** Runs every scheduled slice immediately, so the whole controller behaves synchronously. */
function immediateScheduler(run: () => void) {
  run();
}

describe("renju evaluation", () => {
  describe("whiteEvaluationPercent", () => {
    it("is even at a level score and pinned at a proven win", () => {
      expect(whiteEvaluationPercent(0, null)).to.equal(50);
      expect(whiteEvaluationPercent(0, BLACK)).to.equal(0);
      expect(whiteEvaluationPercent(0, WHITE)).to.equal(100);
    });

    it("moves toward black as black's score rises, and never hides a colour completely", () => {
      const slight = whiteEvaluationPercent(400, null);
      const clear = whiteEvaluationPercent(3000, null);
      expect(slight).to.be.lessThan(50);
      expect(clear).to.be.lessThan(slight);
      expect(whiteEvaluationPercent(1e6, null)).to.be.at.least(2);
      expect(whiteEvaluationPercent(-1e6, null)).to.be.at.most(98);
    });

    it("is symmetric about even", () => {
      expect(whiteEvaluationPercent(900, null) + whiteEvaluationPercent(-900, null)).to.be.closeTo(100, 1e-9);
    });
  });

  describe("evaluationDescription", () => {
    it("describes the pending, unavailable and finished cases", () => {
      expect(evaluationDescription(null)).to.equal("Analysing this position");
      expect(evaluationDescription(null, true)).to.equal("Renju evaluation unavailable");
      expect(evaluationDescription(evaluation({ winner: BLACK, winInPlies: 0 }))).to.equal("Black has five in a row");
    });

    it("counts a forced win in the winner's own moves, not plies", () => {
      expect(evaluationDescription(evaluation({ winner: BLACK, winInPlies: 1 }))).to.equal("Black wins in 1 move");
      expect(evaluationDescription(evaluation({ winner: BLACK, winInPlies: 3 }))).to.equal("Black wins in 2 moves");
      expect(evaluationDescription(evaluation({ winner: WHITE, winInPlies: 5 }))).to.equal("White wins in 3 moves");
    });

    it("grades the positional cases by size and names the side", () => {
      expect(evaluationDescription(evaluation({ score: 40 }))).to.equal("Even position at depth 4");
      expect(evaluationDescription(evaluation({ score: 300 }))).to.equal("Black is slightly better at depth 4");
      expect(evaluationDescription(evaluation({ score: -1000 }))).to.equal("White is clearly better at depth 4");
      expect(evaluationDescription(evaluation({ score: 9000, depth: 6 }))).to.equal("Black is winning at depth 6");
    });
  });

  it("reads the side to move off the stone counts", () => {
    expect(sideToMoveFor(EMPTY_RENJU_BOARD)).to.equal(BLACK);
    expect(sideToMoveFor(board([[7, 7]]))).to.equal(WHITE);
    expect(sideToMoveFor(board([[7, 7]], [[7, 8]]))).to.equal(BLACK);
  });

  it("builds a decided evaluation for a finished game", () => {
    expect(decidedEvaluation(BLACK).whitePercent).to.equal(0);
    expect(decidedEvaluation(WHITE).whitePercent).to.equal(100);
    expect(decidedEvaluation(null).whitePercent).to.equal(50);
  });

  describe("RenjuEvaluator", () => {
    it("reports progressively and ends on a proven win for the side to move", () => {
      const seen: RenjuEvaluation[] = [];
      const evaluator = new RenjuEvaluator((value) => seen.push(value), undefined, immediateScheduler);

      // Black to move (the stone counts are level) with an open three: a proven win three stones
      // out. The white stones are scattered in corners so they threaten nothing.
      evaluator.analyze(
        board(
          [
            [7, 5],
            [7, 6],
            [7, 7],
          ],
          [
            [0, 0],
            [0, 14],
            [14, 0],
          ]
        )
      );

      expect(seen.length).to.be.greaterThan(1); // the meter settles in rather than jumping once
      const last = seen[seen.length - 1];
      expect(last.winner).to.equal(BLACK);
      expect(last.whitePercent).to.equal(0);
      expect(evaluationDescription(last)).to.equal("Black wins in 2 moves");
    });

    it("keeps a balanced opening near the middle of the bar", () => {
      const seen: RenjuEvaluation[] = [];
      const evaluator = new RenjuEvaluator((value) => seen.push(value), undefined, immediateScheduler);

      evaluator.analyze(board([[7, 7]], [[7, 8]]));

      const last = seen[seen.length - 1];
      expect(last.winner).to.equal(null);
      expect(last.whitePercent).to.be.within(35, 65);
    });

    it("ignores a repeat request for the position it is already showing", () => {
      let calls = 0;
      const evaluator = new RenjuEvaluator(() => calls++, undefined, immediateScheduler);
      const position = board([[7, 7]], [[7, 8]]);

      evaluator.analyze(position);
      const afterFirst = calls;
      evaluator.analyze(position);

      expect(calls).to.equal(afterFirst);
    });

    it("abandons a running search when a newer position arrives", () => {
      const pending: (() => void)[] = [];
      const seen: RenjuEvaluation[] = [];
      const evaluator = new RenjuEvaluator(
        (value) => seen.push(value),
        undefined,
        (run) => pending.push(run)
      );

      evaluator.analyze(
        board(
          [
            [7, 5],
            [7, 6],
            [7, 7],
          ],
          [
            [0, 0],
            [0, 14],
            [14, 0],
          ]
        )
      );
      const stale = seen.length;
      // White answers the open three: the proven win is gone, so the two searches disagree and only
      // the newer one may report.
      evaluator.analyze(
        board(
          [
            [7, 5],
            [7, 6],
            [7, 7],
            [13, 13],
          ],
          [
            [0, 0],
            [0, 14],
            [14, 0],
            [7, 8],
          ]
        )
      );
      // Drain everything the first search had queued; only the newer position may report.
      while (pending.length > 0) {
        (pending.shift() as () => void)();
      }

      expect(seen.length).to.be.greaterThan(stale);
      expect(seen[seen.length - 1].winner).to.equal(null); // white blocked the open three
    });

    it("stops reporting once destroyed", () => {
      const pending: (() => void)[] = [];
      let calls = 0;
      const evaluator = new RenjuEvaluator(
        () => calls++,
        undefined,
        (run) => pending.push(run)
      );

      evaluator.analyze(board([[7, 7]], [[7, 8]]));
      const afterStart = calls;
      evaluator.destroy();
      while (pending.length > 0) {
        (pending.shift() as () => void)();
      }

      expect(calls).to.equal(afterStart);
    });
  });
});
