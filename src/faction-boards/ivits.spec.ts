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
});
