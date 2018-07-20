import { expect } from "chai";
import Engine from "../engine";
import { Player } from '../enums';

const parseMoves = Engine.parseMoves;

describe("Federation", () => {
  it("should allow to form a federation and gain rewards. Gaia phase to test income for terrans", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -1x2
      p2 build m -1x-1
      p2 build m 3x-2
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster7
      p1 up gaia.
      p2 build ts -1x-1.
      p1 build gf -2x3.
      p2 build m -1x0.
      p1 leech 1pw
      p1 build ts -1x2.
      p2 leech 1pw
      p2 build m 1x0.
      p1 leech 2pw
      p1 build m -3x4.
      p2 pass booster8
      p1 build PI -1x2.
      p2 leech 1pw
      p1 pass booster3
      p1 income t
      p1 spend 4tg for 1k. spend 2tg for 2c
      p2 burn 3. spend 3pw for 1o. pass booster5
      p1 build m -2x3. spend 2pw for 2c.
      p1 build ts -4x2.
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player1).data;
    const vp = data.victoryPoints;
    const powerTokens = data.discardablePowerTokens();
    engine.move("p1 federation -1x2,-2x3,-3x2,-3x3,-3x4,-4x2 fed2");
    // gets vp for federation and for fed building from roundbooster
    expect(data.victoryPoints).to.equal(vp + 8 + 5);
    expect(data.power.gaia).to.be.gte(0);
    expect(data.satellites).to.equal(2);
    expect(data.discardablePowerTokens()).to.be.equal(powerTokens - 2, "The 2 satellites should remove one power token each");

    // Test other federation with the same buildings
    expect(() => new Engine([...moves, "p1 federation -1x2,-2x3,-3x3,-3x4,-4x2,-4x3 fed2"])).to.not.throw();
  });
});
