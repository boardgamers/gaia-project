import { expect } from "chai";
import Engine from "../engine";
import { Player } from "../enums";

const parseMoves = Engine.parseMoves;

describe("Baltaks", () => {
  it("should test ability to upgrade navigation", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction baltaks
      p1 build m -4x2
      p2 build m -4x0
      p2 build m -1x-3
      p1 build m -1x2
      p2 booster booster4
      p1 booster booster3
      p1 pass booster5
      p2 up nav.
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it("should test ability to use freeaction and reset on new turn", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction baltaks
      p1 build m -4x2
      p2 build m -4x0
      p2 build m -1x-3
      p1 build m -1x2
      p2 booster booster4
      p1 booster booster3
      p1 pass booster5
      p2 spend 1gf for 1q. build m -3x-2.
    `);
    const engine = new Engine(moves);

    expect(engine.player(Player.Player2).data.gaiaformersInGaia).to.equal(1);
    engine.move("p2 pass booster3");
    expect(engine.player(Player.Player2).data.gaiaformersInGaia).to.equal(0);
  });
});
