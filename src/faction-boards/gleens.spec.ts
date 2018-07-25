import { expect } from "chai";
import Engine from "../engine";
import { Player, Federation } from '../enums';

const parseMoves = Engine.parseMoves;

describe("gleens", () => {
  it ("should grant gleens an ore instead of qic when upgrading navigation without an academy", () => {
    const engine = new Engine(parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster5
      p1 build m -5x0.
    `));

    const range = engine.player(Player.Player2).data.range;

    engine.move("p2 up nav");

    expect(engine.player(Player.Player2).data.range).to.equal(range + 1);
  });

  it("should allow Gleens to get the faction federation", () => {
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
      p1 build m -5x0.
      p2 build ts -5x5.
      p1 charge 1pw
      p1 build m -4x2.
      p2 build PI -5x5.
      p1 charge 1pw
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player2).data;

    // tslint:disable-next-line no-unused-expression
    expect(data.tiles.federations.some(fed => fed.tile === Federation.FederationGleens)).to.be.true;
  });

  it('should grant gleens two victory points when building a mine on a gaia planet', () => {
    const engine = new Engine(parseMoves(`
      init 2 randomSeed
      p1 faction gleens
      p2 faction terrans
      p1 build m -2x2
      p2 build m -1x2
      p2 build m -3x4
      p1 build m 1x2
      p2 booster booster3
      p1 booster booster4
      p1 up gaia.
      p2 pass booster5
      p1 build gf -2x3.
      p1 pass booster3
      p2 pass booster4
    `));

    const vp = engine.player(Player.Player1).data.victoryPoints;
    engine.move('p1 build m -2x3');
    expect(engine.player(Player.Player1).data.victoryPoints).to.equal(vp + 2);
  });
});
