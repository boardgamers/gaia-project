import { expect } from 'chai';
import Engine from './engine';
import { Player } from './enums';

const parseMoves = Engine.parseMoves;

describe('Research', () => {
  it("should grant a qic when upgrading navigation", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster5
    `);

    const engine = new Engine(moves);

    const qic = engine.player(Player.Player1).data.qics;

    engine.move("p1 up nav");

    expect(engine.player(Player.Player1).data.qics).to.equal(qic + 1);
  });

  it("should prevent upgrading to last research area without green a federation", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -1x2
      p2 build m -2x2
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster7
      p1 booster booster3
      p1 up gaia.
      p2 up nav.
      p1 build ts -3x4.
      p2 charge 1pw
      p2 build ts -2x2.
      p1 charge 2pw
      p1 build lab -3x4. tech free1. up gaia.
      p2 charge 2pw
      p2 build PI -2x2.
      p1 charge 2pw
      p1 spend 2q for 2o. burn 4. action power3.
      p2 build ts -5x5.
      p1 charge 2pw
      p1 build ac1 -3x4. tech free2. up gaia.
      p2 charge 3pw
      p2 pass booster8
      p1 build gf -2x3.
      p1 special 4pw. spend 4pw for 1k.
      p1 pass booster7
      p2 action power5.
      p1 build m -2x3.
      p2 charge 3pw
      p2 up nav.
    `);

    const engine = new Engine(moves);

    expect(() => engine.move("p1 up gaia.")).to.throw();
  });
});
