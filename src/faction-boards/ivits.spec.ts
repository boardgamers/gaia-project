import { expect } from "chai";
import Engine from "../engine";
import { Player } from '../enums';

const parseMoves = Engine.parseMoves;

describe('Ivits', () => {
  it ("should be able to place a space station and use it as a starting point to build a mine", () => {
    const moves = parseMoves(`
      init 2 randomSeed2
      p1 faction ivits
      p2 faction geodens
      p2 build m 3x-1
      p2 build m -2x-2
      p1 build PI 2x-1
      p2 booster booster5
      p1 booster booster1
      p1 income 4pw
      p1 special space-station. build sp -1x-3.
      p2 pass booster3
      p1 build m -1x-4
    `);

    expect (() => new Engine(moves)).to.not.throw();
  });

  it ("should be able to build a federation using a space station and qic", () => {
    const moves = parseMoves(`
      init 2 randomSeed2
      p1 faction ivits
      p2 faction baltaks
      p2 build m 3x-1
      p2 build m -2x-2
      p1 build PI 2x-1
      p2 booster booster1
      p1 booster booster4
      p1 income 4pw
      p1 special step. build m 1x2.
      p2 build ts 3x-1.
      p1 charge 3pw
      p1 build m 3x0.
      p2 charge 2pw
      p2 build lab 3x-1. tech free3. up gaia.
      p1 charge 3pw
      p1 action power2. build m 2x1.
      p2 charge 2pw
      p2 up gaia.
      p1 up int.
      p2 build gf 2x0.
      p1 special space-station. build sp 1x1.
      p2 spend 1gf for 1q. build m -1x-1.
    `);

    const engine = new Engine(moves);

    const tokens = engine.player(Player.Player1).data.discardablePowerTokens();
    const qic = engine.player(Player.Player1).data.qics;
    engine.move("p1 federation 1x0,1x1,1x2,2x-1,2x1,3x0 fed2.");
    // No tokens discarded
    expect(engine.player(Player.Player1).data.discardablePowerTokens()).to.equal(tokens);
    // 1 qic discarded (satellite) & one gained (federation tile)
    expect(engine.player(Player.Player1).data.qics).to.equal(qic - 1 + 1);
  });
});
