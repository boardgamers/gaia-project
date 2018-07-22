import { expect } from "chai";
import Engine from "./engine";
import { AssertionError } from "assert";
import { Player, Federation, Operator, AdvTechTilePos, Building } from "./enums";

describe("Engine", () => {

  it("should throw when trying to build on the wrong place", () => {
    const moves = [
      "init 2 randomSeed",
      "p1 faction terrans",
      "p2 faction xenos",
      "p1 build m 0x0",
    ];

    expect(() => new Engine(moves)).to.throw();
  });

  it("should allow to set up with Xenos (three mines) without errors", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction xenos
      p1 build m -1x2
      p2 build m -2x2
      p2 build m -5x5
      p1 build m -3x4
      p2 build m -7x3
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to set up with Ivits (PI as last player) without errors", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction ivits
      p2 faction terrans
      p2 build m -1x2
      p2 build m -4x2
      p1 build PI -2x-4
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should have passedPlayers empty at beginning of a new round", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m -4x2
      p2 build m -2x2
      p2 build m 1x2
      p1 build m -4x-1
      p2 booster booster3
      p1 booster booster4
      p1 pass booster5
      p2 pass booster4
    `);

    const engine = new Engine(moves);
    expect(engine.passedPlayers).to.have.length(0);
  });

  it("should check wrong player order", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m -4x2
      p2 build m -2x2
      p2 build m 1x2
      p1 build m -4x-1
      p2 booster booster3
      p1 booster booster4
      p2 pass booster5
    `);
    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should force a player to do an action before ending his turn", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction xenos
      p1 build m -4x2
      p2 build m -7x3
      p2 build m -2x2
      p1 build m -4x-1
      p2 build m -5x5
      p2 booster booster3
      p1 booster booster4
      p1 burn 2
      p2 build m -6x3
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it("should allow players to upgrade a mine to a TS, either isolated or not", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      terrans build m -1x2
      nevlas build m -1x0
      nevlas build m 0x-4
      terrans build m -4x-1
      nevlas booster booster7
      terrans booster booster3
      terrans build ts -1x2.
      nevlas leech 1pw
      nevlas build ts 0x-4
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should throw when upgrading without resources", () => {
    const engine = new Engine(parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction firaks
      p1 build m -3x4
      p2 build m -1x-1
      p2 build m -2x-5
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build m -5x0.
      p2 build m 3x-2.
      p1 build ts -5x0.
      p2 build ts -1x-1.
    `));

    expect(() => engine.move("p1 build ts -4x2")).to.throw();
  });

  it ("should throw when building out of range", () => {
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
    expect(() => engine.move("p1 build -1x0")).to.throw();
  });

  it ("should not spend a qic when building a mine nearby", () => {
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

    engine.move("p1 build m -5x0");

    expect(engine.player(Player.Player1).data.qics).to.equal(qic);
  });

  it("should allow to place a gaia former and next round checks for transformation to gaia planet, pass is checking booster availablity", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -4x2
      p2 build m -1x-1
      p2 build m -2x-5
      p1 build m -1x2
      p2 booster booster3
      p1 booster booster4
      p1 build gf -3x1.
      p2 pass booster7
      p1 pass booster3
      p2 pass booster4
    `);

    const engine = new Engine(moves);

    const qicCount = engine.player(Player.Player1).data.qics;

    engine.move("p1 build m -3x1");

    expect(engine.player(Player.Player1).data.qics).to.equal(qicCount, "Building a mine from a gaia former doest NOT need a qic");
  });

  it("should allow this 4 player game", () => {
    const moves = parseMoves(`
      init 4 randomSeed
      p1 faction terrans
      p2 faction xenos
      p3 faction geodens
      p4 faction nevlas
      p1 build m -1x6
      p2 build m -3x-1
      p3 build m -4x1
      p4 build m -1x3
      p4 build m 1x4
      p3 build m -9x6
      p2 build m 1x5
      p1 build m -5x4
      p2 build m -8x5
      p4 booster booster1
      p3 booster booster2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -1x6.
      p2 leech 1pw
      p4 leech 1pw
      p2 build ts 1x5.
      p4 leech 1pw
      p1 leech 2pw
      p3 build ts -4x1.
      p2 leech 1pw
      p4 build ts 1x4.
      p1 leech 2pw
      p2 leech 2pw
      p1 build m -6x6.
      p2 burn 1. build lab 1x5. tech int. spend 1pw for 1c.
      p4 decline
      p1 decline
      p3 build lab -4x1. tech terra.
      p2 leech 1pw
      p4 build lab 1x4. tech sci. burn 2.
      p1 leech 2pw
      p2 decline
      p1 build gf -6x7. spend 1o for 1c.
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should handle this full 2 player game with lost planet", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -1x2
      p2 build m -2x2
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster5
      p1 booster booster3
      p1 up gaia.
      p2 special range+3. build m 1x0.
      p1 leech 1pw
      p1 build ts -3x4.
      p2 leech 1pw
      p2 build ts -5x5.
      p1 decline
      p1 build lab -3x4. tech free2. up gaia.
      p2 leech 2pw
      p2 build lab -5x5. tech free2. up nav.
      p1 decline
      p1 build gf -2x3.
      p2 up nav.
      p1 build ts -1x2.
      p2 leech 1pw
      p2 action power3.
      p1 special 4pw.
      p2 special 4pw.
      p1 action power5.
      p2 build ts -2x2.
      p1 decline
      p1 build gf -3x1.
      p2 build m 1x2.
      p1 leech 2pw
      p1 pass booster4
      p2 pass booster3
      p1 special 4pw.
      p2 special 4pw.
      p1 up terra.
      p2 action power5.
      p1 action power3.
      p2 up nav.
      p1 build PI -1x2.
      p2 leech 2pw
      p2 spend 1pw for 1c. build PI -2x2.
      p1 decline
      p1 build m -2x3.
      p2 decline
      p2 federation -1x1,-2x2,-3x3,-4x4,-5x5,0x1,0x2,1x0,1x2 fed4. spend 1o for 1t.
      p1 build gf -5x6.
      p2 spend 1k for 1c. build ts 1x0.
      p1 leech 3pw
      p1 spend 3pw for 1o. burn 1. spend 3pw for 1o. build ts -2x3.
      p2 leech 3pw
      p2 spend 2pw for 2c. pass booster7
      p1 federation -1x2,-2x3,-3x4 fed6.
      p1 pass booster5
      p1 income 1t
      p1 spend 4tg for 1q
      p2 build lab 1x0. tech free3. up nav. spend 1pw for 1c. spend 1pw for 1c.
      p1 leech 3pw
      p1 up terra.
      p2 special 4pw. spend 1pw for 1c. spend 1pw for 1c.
      p1 build m -3x1.
      p2 leech 3pw
      p2 spend 1pw for 1c. spend 1o for 1t. pass booster3
      p1 special 4pw.
      p1 action power3.
      p1 special range+3. build gf 0x4.
      p1 spend 1pw for 1c. build m -5x6.
      p2 leech 2pw
      p1 burn 1. spend 2pw for 2c. build m -4x6.
      p2 decline
      p1 pass booster8
      p1 income 4pw
      p1 spend 4tg for 1k
      p2 spend 1o for 1t. special 4pw.
      p1 up terra.
      p2 action power3.
      p1 build m 0x4.
      p2 leech 1pw
      p2 up nav. lostPlanet 1x-4.
      p1 special 4pw.
      p2 build m 4x-1.
      p1 action power4.
      p2 build m 2x-4.
      p1 build m -4x2.
      p2 leech 3pw
      p2 build m -7x3.
      p1 burn 1. spend 4pw for 1q. build m -4x-1.
      p2 pass booster7
      p1 pass booster5
      p1 income 2pw. income 4pw
      p2 build ac2 1x0. tech terra.
      p1 leech 3pw
      p1 build ac2 -3x4. tech terra.
      p2 up terra.
      p1 special 4pw.
      p2 action power3.
      p1 action power5.
      p2 special 4pw.
      p1 up terra.
      p2 special q.
      p1 special range+3. build gf 2x-2.
      p2 build ts 1x2.
      p1 leech 3pw
      p1 special q.
      p2 pass booster8
      p1 burn 1. action power4.
      p1 build ts -3x1.
      p2 decline
      p1 pass booster7
      p1 income 4pw
      p1 spend 4tg for 1q
      p2 action power4.
      p1 special 4pw.
      p2 up terra.
      p1 special q.
      p2 build m -4x0.
      p1 leech 2pw
      p1 build m 2x-2.
      p2 leech 3pw
      p2 special q.
      p1 up gaia.
      p2 build lab 1x2. tech adv-nav. cover terra. up terra.
      p1 leech 3pw
      p1 action qic2. fedtile fed6.
      p2 build ts 2x-4.
      p1 leech 1pw
      p1 action power5.
      p2 special 4pw.
      p1 up gaia.
      p2 action power3.
      p1 build ts -4x2.
      p2 decline
      p2 build m -3x-2.
      p1 leech 1pw
      p1 build ts -4x-1.
      p2 leech 1pw
      p2 action qic3.
      p1 spend 3pw for 1o. build m -5x0.
      p2 leech 1pw
      p2 pass
      p1 federation -3x-1,-3x0,-3x1,-4x-1,-4x2,-5x0 fed1.
      p1 pass
    `);

    const engine = new Engine(moves);

    expect(engine.player(Player.Player1).data.victoryPoints).to.equal(122);
    expect(engine.player(Player.Player2).data.victoryPoints).to.equal(95);
  });

  it("should throw when two players choose factions on the same planet", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction lantids"];

    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should throw when two players choose the same faction", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction terrans"];

    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should give a valid JSON even when not initialized", () => {
    expect(() => JSON.stringify(new Engine([]))).to.not.throw();
  });

  it("should allow to decide incomes", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction ivits
      p2 faction nevlas
      p2 build m 0x-4
      p2 build m -1x0
      p1 build PI -2x-4
      p2 booster booster4
      p1 booster booster5
    `);

    const engine = new Engine(moves);
    expect(() => new Engine([...moves, "p1 income 4pw,t"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 income t,2pw"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 income t"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 income 3pw"])).to.throw();
  });

  it("should handle when an income event contains another reward in addition to the power token", () => {
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
      p2 leech 1pw
      p2 build ts -1x0.
      p1 leech 2pw
      p1 build lab -1x2. tech gaia.
      p2 leech 2pw
      p2 up gaia.
      p1 up gaia.
      p2 spend 1o for 1t. build gf -3x1. burn 2.
      p1 pass booster5
      p2 build PI -1x0.
      p1 leech 2pw
      p2 pass booster4
    `);

    expect(() => new Engine([...moves, "p2 income 1t,1t. income 1t"])).to.throw();
    expect(() => new Engine([...moves, "p2 income 1t,1t"])).to.not.throw();
  });
});

function parseMoves(moves: string) {
  return Engine.parseMoves(moves);
}
