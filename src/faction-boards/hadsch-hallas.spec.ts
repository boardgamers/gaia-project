import { expect } from "chai";
import Engine from "../engine";

const parseMoves = Engine.parseMoves;

describe('Hadsch Hallas', () => {
  it("should grant hadsch hallas new free actions after the PI is built", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction hadsch-hallas
      p2 faction ambas
      p1 build m -5x0
      p2 build m -3x-2
      p2 build m 2x4
      p1 build m 1x5
      p2 booster booster3
      p1 booster booster7
      p1 build ts 1x5.
      p2 leech 1pw
      p2 build ts 2x4.
      p1 leech 2pw
      p1 build PI 1x5. spend 4c for 1k
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });
});
