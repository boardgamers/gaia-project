import { expect } from "chai";
import Engine from "../engine";
import { Player } from '../enums';

const parseMoves = Engine.parseMoves;

describe("Ambas", () => {
  it("should allow Ambas to use piswap", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction nevlas
      p2 faction ambas
      p1 build m 2x2
      p2 build m 2x4
      p2 build m 5x-3
      p1 build m 3x-3
      p2 booster booster3
      p1 booster booster4
      p1 build ts 2x2.
      p2 charge 1pw
      p2 build ts 2x4.
      p1 charge 2pw
      p1 pass booster7
      p2 build PI 2x4.
      p1 charge 2pw
    `);

    expect(() => new Engine([...moves, "p2 special swap-PI. swap-PI 5x-3."])).to.not.throw();
    expect(() => new Engine([...moves, "p2 special swap-PI. swap-PI 3x-3."])).to.throw();
  });
});
