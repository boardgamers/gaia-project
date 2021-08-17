import { expect } from "chai";
import Engine from "../engine";
import { Operator, Player } from "../enums";

const parseMoves = Engine.parseMoves;

describe("boosters", () => {
  it("should have the correct number of round boosters depending on the number of players", () => {
    const engine2 = new Engine(["init 2 randomSeed"]);
    const engine3 = new Engine(["init 3 randomSeed"]);
    const engine4 = new Engine(["init 4 randomSeed"]);
    const engine5 = new Engine(["init 5 randomSeed"]);

    expect(Object.keys(engine2.tiles.boosters)).to.have.length(5);
    expect(Object.keys(engine3.tiles.boosters)).to.have.length(6);
    expect(Object.keys(engine4.tiles.boosters)).to.have.length(7);
    expect(Object.keys(engine5.tiles.boosters)).to.have.length(8);
  });

  it("should throw when selecting invalid round booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster2
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it("should throw when selecting taken round booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster4
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it("should gain 2 victory points when upgrading to ts and having booster7", () => {
    // booster7: ["o", "ts | 2vp"]
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster7
      p1 booster booster3
      p1 build m -4x0.
      p2 build ts -5x5.
      p1 charge 1pw
      p1 pass booster4 returning booster3
    `);

    const engine = new Engine(moves);
    const vp = engine.player(Player.Player2).data.victoryPoints;

    engine.move("p2 pass booster3");

    expect(engine.player(Player.Player2).data.victoryPoints).to.equal(vp + 2);
  });

  it("should allow to use a terraforming special action from a booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -1x2
      p2 booster booster5
      p1 booster booster4
    `);
    const engine = new Engine(moves);

    expect(() => new Engine([...moves, "p1 special step"])).to.not.throw();
    // tslint:disable-next-line no-unused-expression
    expect(
      new Engine([...moves, "p1 special step. build m -2x2."]).player(Player.Player1).events[Operator.Activate][0]
        .activated
    ).to.be.true;

    // The step special action can't be used to build a gaia-former
    expect(() => new Engine([...moves, "p1 special step. build gf -2x3."])).to.throw();

    // test free action before and after, and to build something different then a mine
    expect(() => new Engine([...moves, "p1 spend 2o for 2c. special step. build m -1x-1"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 spend 1o for 1c. special step. build ts -4x2"])).to.throw();
    expect(() => new Engine([...moves, "p1 special step. build m -1x-1. spend 1o for 1c."])).to.not.throw();
  });

  it("should allow to use a range special action from a booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster5
    `);

    expect(() => new Engine([...moves, "p1 special range+3. build m -4x-1"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 special range+3. build gf 0x4"])).to.not.throw();
  });

  it("should not allow range booster to be used when building is impossible", () => {
    const moves = parseMoves(`
      init 2 661
      p1 faction ivits
      p2 faction firaks
      firaks build m 4A0
      ivits build PI 2A3
      firaks build m 3A3
      firaks booster booster4
      ivits booster booster5
      ivits build m 2A7.
      firaks pass booster9 returning booster4
      ivits spend 1o for 1t. special range+3.
    `);

    expect(() => new Engine([...moves], { factionVariant: "more-balanced" })).to.throw(
      "Command endturn is not in the list of available commands"
    );
  });
});
