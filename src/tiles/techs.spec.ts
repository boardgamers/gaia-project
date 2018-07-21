import { expect } from 'chai';
import Engine from '../engine';
import {Player, AdvTechTilePos} from '../enums';

describe("Tech Tiles", () => {
  it("should prevent picking the same tech tile twice", () => {
    const moves = Engine.parseMoves(`
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
      p2 up sci.
      p1 build ts -3x4.
      p2 leech 1pw
      p2 build ts -2x2.
      p1 leech 2pw
      p1 build lab -3x4. tech free1. up gaia.
      p2 leech 2pw
      p2 build PI -2x2.
      p1 leech 2pw
      p1 spend 2q for 2o. burn 4. action power3.
      p2 build ts -5x5.
      p1 leech 2pw
    `);

    const engine = new Engine(moves);

    expect(() => engine.move('p1 build ac1 -3x4. tech free1')).to.throw();
  });

  it("should allow to upgrade research area after building a RL, pick tech in nav", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -4x2
      p2 build m -1x-1
      p2 build m -2x-5
      p1 build m -1x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -1x2.
      p2 pass booster5
      p1 build lab -1x2. tech nav.
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to get an advanced tech tiles when conditions are met", () => {
    const moves = Engine.parseMoves(`
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
      p2 leech 1pw
      p2 build ts -2x2.
      p1 leech 2pw
      p1 build lab -3x4. tech free1. up gaia.
      p2 leech 2pw
      p2 build PI -2x2.
      p1 leech 2pw
      p1 spend 2q for 2o. burn 4. action power3.
      p2 build ts -5x5.
      p1 leech 2pw
      p1 build ac1 -3x4. tech free2. up gaia.
      p2 leech 3pw
      p2 pass booster8
      p1 build gf -2x3.
      p1 special 4pw. spend 4pw for 1k.
      p1 pass booster7
      p2 action power5.
      p1 build m -2x3.
      p2 leech 3pw
      p2 up nav.
      p1 spend 2k for 2c. build ts -2x3.
      p2 leech 3pw
      p2 build m -4x6.
      p1 leech 4pw
      p1 federation -1x2,-2x3,-3x4 fed6.
      p2 build ts -4x6.
      p1 leech 4pw
      p1 action power3.
      p2 federation -2x2,-3x3,-4x4,-4x5,-4x6,-5x5 fed4.
      p1 special 4pw.
      p2 spend 3pw for 1o. pass booster3
      p1 up terra.
      p1 pass booster4
      p2 build lab -5x5. tech free2. up nav.
      p1 leech 4pw
    `);

    const engine = new Engine(moves);

    expect(() => engine.move('p1 build lab -2x3. tech adv-gaia. cover free1. up gaia.')).to.throw();

    const engine1 = new Engine(moves);
    expect(() => engine1.move('p1 build lab -2x3. tech adv-gaia. cover free1. up terra.')).to.not.throw();
    // tslint:disable-next-line no-unused-expression
    expect(engine1.player(Player.Player1).data.advTechTiles.find(tile => tile.pos === AdvTechTilePos.GaiaProject)).to.not.be.undefined;
    expect(engine1.advTechTiles[AdvTechTilePos.GaiaProject].numTiles).to.equal(0);
  });
});
