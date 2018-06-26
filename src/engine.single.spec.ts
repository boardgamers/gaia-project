import { expect } from "chai";
import Engine from "..";
import { AssertionError } from "assert";
import { Player } from "./enums";

describe("Engine", () => {

  it("should allow a full round to pass", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster3
      p1 build ts 2x2
      p2 leech 1
      p2 pass booster5
      p1 build ts 4x0
      p2 leech 1
      p1 pass booster2
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

});

function parseMoves(moves: string) {
  return moves.trim().split("\n").map(move => move.trim());
}