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

  it("should prevent upgrading to last research track when another player is there", function() {
    this.timeout(10000);

    const moves = Engine.parseMoves(`
      init 2 zadbd
      p1 faction geodens
      p2 faction lantids
      geodens build m 2x-1
      lantids build m 3x-1
      lantids build m 1x-3
      geodens build m 4x-5
      lantids booster booster1
      geodens booster booster4
      geodens build ts 2x-1.
      lantids charge 1pw
      lantids build ts 3x-1.
      geodens charge 2pw
      geodens build PI 2x-1.
      lantids charge 2pw
      lantids build PI 3x-1.
      geodens charge 3pw
      geodens special step. build m 3x-2.
      lantids charge 3pw
      lantids build m 3x-2.
      geodens charge 3pw
      geodens action power5.
      lantids build m 2x-1.
      geodens charge 3pw
      geodens up terra.
      lantids up terra.
      geodens up terra.
      lantids up terra.
      geodens action power3.
      lantids spend 2pw for 2c. build m 4x-5.
      geodens charge 1pw
      geodens build m 2x-4.
      lantids charge 1pw
      lantids federation 1x-3,2x-1,2x-3,3x-1,3x-2,3x-3,3x-4,4x-5 fed3.
      geodens up terra.
      lantids pass booster10
      geodens build ts 3x-2.
      lantids charge 3pw
      geodens federation 2x-1,2x-4,3x-2,3x-3,3x-4,4x-5 fed2.
      geodens pass booster1
      lantids income 1t
      geodens income 4pw
      lantids action power5.
      geodens build m 3x-6.
      lantids charge 1pw
      lantids up terra.
      geodens up terra.
      lantids build m 2x-4.
      geodens charge 1pw
      geodens burn 1. action power4.
      lantids up terra.
      geodens build lab 3x-2. tech nav. up nav.
      lantids charge 3pw
      lantids spend 3pw for 3c. build ts 1x-3.
      geodens charge 1pw
      geodens up int.
      lantids pass booster8
      geodens spend 2q for 2o. build ts 2x-4.
      lantids charge 2pw
      geodens pass booster10
      lantids income 4pw
      geodens income 4pw
      lantids pass booster1
      geodens pass booster8
      lantids income 4pw
      geodens income 4pw
      lantids pass booster10
      geodens pass booster7
      lantids income 1t
      geodens income 4pw
      lantids pass booster8
      geodens pass booster10
      lantids income 1t
      geodens income 4pw
      lantids action power4.
      geodens pass
    `);

    const engine = new Engine(moves);

    expect(() => engine.move('lantids up terra.')).to.throw();
  });
});
