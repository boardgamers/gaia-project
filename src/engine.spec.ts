import { expect } from "chai";
import Engine from "..";
import { AssertionError } from "assert";

describe("Engine", () => {

  it("should throw when trying to build on the wrong place", () => {
    const moves = [
      "init 2 randomSeed",
      "p1 faction terrans",
      "p2 faction xenos",
      "p1 build m 0x0",
    ];

    expect(() => new Engine(moves)).to.throw();
  });

  it("should allow a simple setup without errors", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction ambas
      p1 build m 2x2
      p2 build m -2x5
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to set up with Xenos (three mines) without errors", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction xenos
      p1 build m 2x2
      p2 build m 3x0
      p2 build m 0x3
      p1 build m -7x2
      p2 build m 2x-3
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to set up with Ivits (PI as last player) without errors", () => {
    const moves = parseMoves(`  
      init 2 randomSeed
      p1 faction terrans
      p2 faction ivits
      p1 build m 2x2
      p1 build m 4x0
      p2 build PI -1x-1
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });



  it("should allow players to pass", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p1 pass
    `);

    expect(() => new Engine(moves)).to.not.throw();
  })
  
  it("should check wrong player order", () => {
    const moves = parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction nevlas
    p1 build m 4x0
    p2 build m 4x-2
    p2 build m -4x3
    p1 build m -7x2
    p1 build ts 4x0
    p2 build ts -4x3
    p2 pass
    `);
    expect(() => new Engine(moves)).to.throw(AssertionError);
  })

  it("should allow players to upgrade a mine to a TS, either isolated or not", () => {
    const moves = parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction nevlas
    p1 build m 4x0
    p2 build m 4x-2
    p2 build m -4x3
    p1 build m -7x2
    p1 build ts 4x0
    p2 build ts -4x3  
    `);

    expect(() => new Engine(moves)).to.not.throw();
  })

  // TODO we should check resources after upgrading
  // TODO test to do: bescods upgrade 
  // TODO test to do: uprgrade to RL an AC1 AC2, to PI
  
  it ("should throw when upgrading without resources", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m -7x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 2x2
      p1 build ts 2x2
      p2 build ts 0x3
      p1 build PI 2x2
      p2 build PI 0x3
      p1 build ts -7x2
    `);

    expect(() => new Engine(moves)).to.throw();
  })

  it("should allow a full round to pass", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p1 build m -7x2
      p2 pass
      p1 build m 4x-6
      p1 pass
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should throw when two players choose factions on the same planet", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction lantids"];

    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should throw when two players choose the same faction", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction terrans"];

    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should give a valid JSON even when not initialized", () => {
    expect(() => JSON.stringify(new Engine([]))).to.not.throw();
  });
});

function parseMoves(moves: string) {
  return moves.trim().split("\n").map(move => move.trim());
}