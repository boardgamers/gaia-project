import { expect } from "chai";
import { EMPTY_RENJU_BOARD, RENJU_SIZE, placeStone } from "./renju";
import {
  analyzeBoard,
  BLACK,
  IterativeSearch,
  PATTERN_WEIGHTS,
  Position,
  SearchOptions,
  toCells,
  WHITE,
  WIN_THRESHOLD,
} from "./renju-engine";

/** Builds a board from `{row, column, stone}` triples, as `[row, column]` pairs per colour. */
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

function positionOf(position: string): Position {
  return new Position(toCells(position));
}

function at(row: number, column: number): number {
  return row * RENJU_SIZE + column;
}

// Small but real: deep enough to prove the tactics these tests are about, fast enough for CI.
const OPTIONS: SearchOptions = { maxDepth: 4, nodeBudget: 60_000, vcfDepth: 8, rootWidth: 14, innerWidth: 8 };

describe("renju engine", () => {
  describe("position bookkeeping", () => {
    it("scores a lone stone by the live windows it sits in", () => {
      // The centre point belongs to 4 directions x 5 offsets = 20 windows, all of them still live.
      const centre = positionOf(board([[7, 7]]));
      expect(centre.score(BLACK)).to.equal(20 * PATTERN_WEIGHTS[1]);
      expect(centre.score(WHITE)).to.equal(-20 * PATTERN_WEIGHTS[1]);
    });

    it("values an open three above a blocked three, with no pattern list to maintain", () => {
      const open = positionOf(
        board([
          [7, 6],
          [7, 7],
          [7, 8],
        ])
      );
      const blocked = positionOf(
        board(
          [
            [7, 6],
            [7, 7],
            [7, 8],
          ],
          [
            [7, 5],
            [7, 9],
          ]
        )
      );
      expect(open.score(BLACK)).to.be.greaterThan(blocked.score(BLACK));
    });

    it("keeps incremental scores identical to a rebuild after place/undo", () => {
      const position = positionOf(board([[7, 7]]));
      const before = position.score(BLACK);
      position.place(at(7, 8), WHITE);
      position.place(at(8, 8), BLACK);
      expect(position.score(BLACK)).to.equal(
        positionOf(
          board(
            [
              [7, 7],
              [8, 8],
            ],
            [[7, 8]]
          )
        ).score(BLACK)
      );
      position.undo(at(8, 8));
      position.undo(at(7, 8));
      expect(position.score(BLACK)).to.equal(before);
    });

    it("only offers empty points near a stone, and the centre on an empty board", () => {
      expect(positionOf(EMPTY_RENJU_BOARD).candidates()).to.deep.equal([at(7, 7)]);
      const candidates = positionOf(board([[7, 7]])).candidates();
      expect(candidates).to.have.length(24); // the 5x5 neighbourhood minus the stone itself
      expect(candidates).to.not.include(at(7, 7));
      expect(candidates).to.include(at(5, 5));
      expect(candidates).to.not.include(at(4, 4));
    });
  });

  describe("the exactly-five house rule", () => {
    it("finds both completing points of an open four", () => {
      const position = positionOf(
        board([
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
        ])
      );
      expect(position.winningMoves(BLACK).sort()).to.deep.equal([at(7, 3), at(7, 8)].sort());
    });

    it("does not call a move a win when it would produce an overline", () => {
      // b b . b b b  -> filling the gap makes SIX in a row, which does not win under this board's
      // rules, and there is no other completing point on the line.
      const position = positionOf(
        board([
          [7, 2],
          [7, 3],
          [7, 5],
          [7, 6],
          [7, 7],
        ])
      );
      expect(position.winningMoves(BLACK)).to.deep.equal([]);
    });

    it("does not report an overline already on the board as a five", () => {
      const six = positionOf(
        board([
          [7, 3],
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
          [7, 8],
        ])
      );
      expect(six.hasFive(BLACK)).to.equal(false);
      const five = positionOf(
        board([
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
          [7, 8],
        ])
      );
      expect(five.hasFive(BLACK)).to.equal(true);
    });

    it("ignores a window the opponent has already poisoned", () => {
      const position = positionOf(
        board([
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
        ])
      );
      position.place(at(7, 3), WHITE);
      position.place(at(7, 8), WHITE);
      expect(position.winningMoves(BLACK)).to.deep.equal([]);
    });
  });

  describe("search", () => {
    it("reports a completed five as decided, with no search at all", () => {
      const result = analyzeBoard(
        board([
          [7, 3],
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
        ]),
        WHITE,
        OPTIONS
      );
      expect(result.winner).to.equal(BLACK);
      expect(result.winInPlies).to.equal(0);
      expect(result.nodes).to.equal(0);
    });

    it("sees its own five one stone away", () => {
      const result = analyzeBoard(
        board([
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
        ]),
        BLACK,
        OPTIONS
      );
      expect(result.winner).to.equal(BLACK);
      expect(result.winInPlies).to.equal(1);
    });

    it("sees that an open four cannot be blocked, even from the defender's side", () => {
      // Black has .bbbb. and it is WHITE to move: white can block only one end.
      const result = analyzeBoard(
        board(
          [
            [7, 4],
            [7, 5],
            [7, 6],
            [7, 7],
          ],
          [[0, 0]]
        ),
        WHITE,
        OPTIONS
      );
      expect(result.winner).to.equal(BLACK);
      expect(result.score).to.be.greaterThan(WIN_THRESHOLD);
    });

    it("forces the defender to block a single four rather than playing elsewhere", () => {
      // Black threatens at (7,8) only; white to move must block, so the position is NOT lost yet.
      const result = analyzeBoard(
        board(
          [
            [7, 4],
            [7, 5],
            [7, 6],
            [7, 7],
          ],
          [[7, 3]]
        ),
        WHITE,
        OPTIONS
      );
      expect(result.winner).to.equal(null);
    });

    it("turns an open three into a proven win three stones out (VCF only, no main search)", () => {
      // maxDepth 0 disables the main search entirely, so this is purely the forcing-four solver:
      // black extends to an open four, black blocks one end, black completes the other.
      const result = analyzeBoard(
        board([
          [7, 5],
          [7, 6],
          [7, 7],
        ]),
        BLACK,
        {
          maxDepth: 0,
          nodeBudget: 60_000,
          vcfDepth: 10,
        }
      );
      expect(result.winner).to.equal(BLACK);
      expect(result.winInPlies).to.equal(3);
    });

    it("follows a multi-move forcing sequence the main search is far too shallow to see", () => {
      // Black's only four is (7,5), which white must answer at (7,6). That same stone lands on the
      // a1-h8 diagonal, turning two black stones into an open three - which then converts into an
      // unanswerable open four. Five stones from here, and no shorter win exists.
      const position = board(
        [
          [7, 2],
          [7, 3],
          [7, 4],
          [9, 3],
          [8, 4],
        ],
        [
          [7, 1],
          [0, 0],
          [0, 14],
          [13, 2],
          [2, 13],
        ]
      );
      const result = analyzeBoard(position, BLACK, { maxDepth: 0, nodeBudget: 200_000, vcfDepth: 12 });
      expect(result.winner).to.equal(BLACK);
      expect(result.winInPlies).to.equal(5);
    });

    it("does not credit a forcing sequence to the player who does not have the move", () => {
      // Black's open three is only a win with the move in hand; with white to play it is not proven.
      const result = analyzeBoard(
        board(
          [
            [7, 5],
            [7, 6],
            [7, 7],
          ],
          [[0, 0]]
        ),
        WHITE,
        {
          maxDepth: 0,
          nodeBudget: 60_000,
          vcfDepth: 10,
        }
      );
      expect(result.winner).to.equal(null);
    });

    it("prefers the faster of two wins", () => {
      const immediate = analyzeBoard(
        board([
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
        ]),
        BLACK,
        OPTIONS
      );
      const forced = analyzeBoard(
        board([
          [7, 5],
          [7, 6],
          [7, 7],
        ]),
        BLACK,
        { ...OPTIONS, vcfDepth: 10 }
      );
      expect(immediate.winInPlies).to.equal(1);
      expect(forced.winInPlies as number).to.be.greaterThan(immediate.winInPlies as number);
      expect(immediate.score).to.be.greaterThan(forced.score);
    });

    it("stays inside its node budget and still returns the last completed depth", () => {
      const result = analyzeBoard(
        board(
          [
            [7, 7],
            [8, 8],
          ],
          [[7, 8]]
        ),
        BLACK,
        {
          maxDepth: 8,
          nodeBudget: 400,
          vcfDepth: 0,
        }
      );
      expect(result.nodes).to.be.at.most(500);
      expect(result.exhausted).to.equal(true);
      expect(Number.isFinite(result.score)).to.equal(true);
    });

    it("is symmetric: mirroring the colours mirrors the score", () => {
      const blackAhead = analyzeBoard(
        board(
          [
            [7, 6],
            [7, 7],
            [7, 8],
          ],
          [[2, 2]]
        ),
        WHITE,
        OPTIONS
      );
      const whiteAhead = analyzeBoard(
        board(
          [[2, 2]],
          [
            [7, 6],
            [7, 7],
            [7, 8],
          ]
        ),
        BLACK,
        OPTIONS
      );
      expect(blackAhead.score).to.be.greaterThan(0);
      expect(whiteAhead.score).to.be.lessThan(0);
    });

    it("scores a balanced opening near even", () => {
      const result = analyzeBoard(board([[7, 7]], [[7, 8]]), BLACK, OPTIONS);
      expect(Math.abs(result.score)).to.be.lessThan(PATTERN_WEIGHTS[3]);
    });
  });

  describe("stepping", () => {
    it("reaches the same answer one root move at a time as it does in one go", () => {
      const position = board(
        [
          [7, 7],
          [8, 8],
          [6, 8],
        ],
        [
          [7, 8],
          [8, 7],
        ]
      );
      const stepped = new IterativeSearch(positionOf(position), BLACK, OPTIONS);
      let slices = 0;
      while (stepped.step()) {
        slices++;
        expect(slices).to.be.lessThan(1000); // step() must always make progress
      }
      expect(slices).to.be.greaterThan(1);
      expect(stepped.finished).to.equal(true);
      expect(stepped.result).to.deep.equal(analyzeBoard(position, BLACK, OPTIONS));
    });

    it("has a usable result before it has finished, and never leaves the board mutated", () => {
      const position = positionOf(
        board(
          [
            [7, 7],
            [8, 8],
          ],
          [[7, 8]]
        )
      );
      const before = position.score(BLACK);
      const search = new IterativeSearch(position, BLACK, OPTIONS);
      search.step();
      expect(Number.isFinite(search.result.score)).to.equal(true);
      while (search.step()) {
        // finish the rest
      }
      expect(position.score(BLACK)).to.equal(before);
    });
  });

  describe("performance", () => {
    it("finishes a mid-game position well inside an interactive budget", function () {
      this.timeout(4000);
      const position = board(
        [
          [7, 7],
          [8, 8],
          [6, 8],
          [9, 9],
          [5, 7],
        ],
        [
          [7, 8],
          [8, 7],
          [6, 7],
          [9, 8],
          [5, 8],
        ]
      );
      const started = Date.now();
      const result = analyzeBoard(position, BLACK, {
        maxDepth: 6,
        nodeBudget: 40_000,
        vcfDepth: 8,
        rootWidth: 16,
        innerWidth: 8,
      });
      expect(Date.now() - started).to.be.lessThan(3000);
      expect(result.depth).to.be.at.least(2);
    });
  });
});
