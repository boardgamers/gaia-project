import { expect } from "chai";
import Engine from "../engine";
import { AdvTechTilePos, Command, Player, TechTilePos } from "../enums";

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
    `);

    const engine = new Engine(moves);

    expect(() => engine.move("p1 build ac1 -3x4. tech free1")).to.throw();
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
    `);

    const engine = new Engine(moves);

    /** Spends two green federations: one for the last tile, one for the advanced tech */
    expect(() => engine.move("p1 build lab -1x2. tech nav. up nav.")).to.not.throw();
    // tslint:disable-next-line no-unused-expression
    expect(engine.player(Player.Player1).data.tiles.techs.find((tile) => tile.pos === TechTilePos.Navigation)).to.not.be
      .undefined;

    const engine1 = new Engine(moves);
    expect(() => engine1.move("p1 build lab -1x2. tech nav. decline.")).to.not.throw();
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
      p1 spend 2k for 2c. build ts -2x3.
      p2 charge 2pw
      p2 build m -4x6.
      p1 charge 4pw
      p1 federation -1x2,-2x3,-3x4 fed6.
      p2 build ts -4x6.
      p1 charge 4pw
      p1 action power3.
      p2 federation -2x2,-3x3,-4x4,-4x5,-4x6,-5x5 fed4.
      p1 special 4pw.
      p2 spend 3pw for 1o. pass booster3
      p1 up terra.
      p1 pass booster4
      p2 build lab -5x5. tech free2. up nav.
      p1 charge 4pw
    `);

    const engine = new Engine(moves);

    /** Spends two green federations: one for the last tile, one for the advanced tech */
    expect(() => engine.move("p1 build lab -2x3. tech adv-gaia. cover free1. up gaia.")).to.throw();

    const engine1 = new Engine(moves);
    expect(() => engine1.move("p1 build lab -2x3. tech adv-gaia. cover free1. up terra.")).to.not.throw();
    // tslint:disable-next-line no-unused-expression
    expect(engine1.player(Player.Player1).data.tiles.techs.find((tile) => tile.pos === AdvTechTilePos.GaiaProject)).to
      .not.be.undefined;
    expect(engine1.tiles.techs[AdvTechTilePos.GaiaProject].count).to.equal(0);

    const engine2 = new Engine(moves);
    expect(() => engine2.move("p1 build lab -2x3. tech adv-gaia. cover free1. decline.")).to.not.throw();
  });

  it("should refuse advanced tech tile when no tech tile to cover", () => {
    const moves = Engine.parseMoves(`
      init 3 polite-food-8474
      p1 faction hadsch-hallas
      p2 faction itars
      p3 faction ambas
      hadsch-hallas build m 0x2
      itars build m 1x4
      ambas build m -7x3
      ambas build m 1x-1
      itars build m -6x8
      hadsch-hallas build m 2x-4
      ambas booster booster4
      itars booster booster2
      hadsch-hallas booster booster1
      hadsch-hallas build m -1x3.
      itars up eco.
      ambas up nav.
      hadsch-hallas build m -1x4.
      itars charge 1pw
      itars build ts 1x4.
      hadsch-hallas charge 1pw
      ambas special step. build m 1x-3.
      hadsch-hallas charge 1pw
      hadsch-hallas up eco.
      itars build lab 1x4. tech terra. up terra.
      hadsch-hallas charge 1pw
      ambas build m -5x3.
      hadsch-hallas pass booster7
      itars special 4pw.
      ambas build m -4x1.
      itars build ac1 1x4. tech free3. up eco.
      hadsch-hallas charge 1pw
      ambas build m -4x-1.
      itars burn 4. action power3.
      ambas build ts 1x-3.
      hadsch-hallas charge 1pw
      itars pass booster10
      ambas pass booster1
      itars income 2pw
      hadsch-hallas action power6. build m 1x2.
      itars charge 3pw
      itars up gaia.
      ambas build lab 1x-3. tech terra. up terra.
      hadsch-hallas charge 1pw
      hadsch-hallas build ts 1x2.
      itars charge 3pw
      itars burn 1. spend 1pw for 1c. special 4pw. burn 5. spend 1pw for 1c.
      ambas special 4pw.
      hadsch-hallas build PI 1x2.
      itars charge 3pw
      itars action power3.
      ambas pass booster2
      hadsch-hallas build ts -1x4.
      itars charge 3pw
      itars burn 1. action power7.
      hadsch-hallas federation -1x4,-1x3,0x2,1x2 fed6.
      itars build gf -5x7.
      hadsch-hallas up eco.
      itars build ts -6x8.
      hadsch-hallas action power5.
      itars build PI -6x8.
      hadsch-hallas pass booster1
      itars pass booster4
      hadsch-hallas income 1t
      itars income 1t. income 1t
      itars spend 4tg for tech. tech free2. up sci. spend 4tg for tech. tech free1. up sci. spend 4tg for tech. tech int. up int
      ambas pass booster7
      hadsch-hallas burn 2. action power5.
      itars special step. build m 0x3.
      hadsch-hallas charge 3pw
      hadsch-hallas up eco.
      itars spend 3pw for 1o. special 4pw.
      hadsch-hallas build ts 2x-4.
      ambas decline 2pw
      itars up sci.
    `);

    const engine = new Engine(moves);
    engine.move("hadsch-hallas build lab 2x-4", true);

    const availableCommand = engine.findAvailableCommand(Player.Player1, Command.ChooseTechTile);
    // tslint:disable-next-line no-unused-expression
    expect(availableCommand.data.tiles.find((tech) => tech.pos === AdvTechTilePos.Economy)).to.be.undefined;
  });
});
