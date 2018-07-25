import { expect } from "chai";
import Engine from "../engine";
import { Player, Federation } from '../enums';

const parseMoves = Engine.parseMoves;

describe("Firaks", () => {
  it ("should allow firaks to downgrade a research lab to a ts and advance research after PI", () => {
    const engine = new Engine(parseMoves(`
      init 2 randomSeed
      p1 faction firaks
      p2 faction nevlas
      p1 build m -1x-1
      p2 build m -1x0
      p2 build m 3x-3
      p1 build m 3x-2
      p2 booster booster3
      p1 booster booster7
      p1 build ts -1x-1.
      p2 charge 1pw
      p2 build ts -1x0.
      p1 charge 2pw
      p1 build PI -1x-1.
      p2 charge 2pw
      p2 build PI -1x0.
      p1 charge 3pw
      p1 up terra.
      p2 up sci.
      p1 build ts 3x-2.
      p2 charge 1pw
      p2 spend 1q for 1o. build ts 3x-3.
      p1 charge 2pw
      p1 action power3.
      p2 burn 2. spend 4t-a3 for 4k. up sci.
      p1 spend 1pw for 1c. spend 1q for 1o. spend 1o for 1c. build lab 3x-2. tech terra. up terra.
      p2 pass booster4
    `));

    expect(() => engine.move("p1 special down-lab. build ts 3x-2. up terra.")).to.not.throw();
  });
});

