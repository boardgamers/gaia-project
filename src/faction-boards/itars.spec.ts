import { expect } from "chai";
import Engine from "../engine";
import { Player } from '../enums';

const parseMoves = Engine.parseMoves;

describe('Itars', () => {
  it ("should be able to gain a tech tile and decline another after PI is built", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction itars
      p1 build m -1x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -1x2.
      p2 charge 1pw
      p2 build ts -1x0.
      p1 charge 2pw
      p1 build lab -1x2. tech gaia. up gaia.
      p2 charge 2pw
      p2 up gaia.
      p1 up gaia.
      p2 spend 1o for 1t. build gf -3x1. burn 2.
      p1 pass booster5
      p2 build PI -1x0.
      p1 charge 2pw
      p2 pass booster4
      p2 income 4pw
      p2 spend 4tg for tech. tech int. decline
      p1 build m -3x4
    `);

    expect (() => new Engine(moves)).to.not.throw();
  });

  it("should autocharge when no power tokens are going to be put in area3", () => {
    const engine = new Engine();
    expect(engine.autoChargeItars(2, 2)).to.be.true;
    expect(engine.autoChargeItars(1, 2)).to.be.false;
    expect(engine.autoChargeItars(0, 1)).to.be.false;
  });
});
