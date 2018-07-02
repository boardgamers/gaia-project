import { expect } from "chai";
import Engine from "..";
import { AssertionError } from "assert";
import { Player } from "./enums";

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

  it("should allow a simple setup without errors", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction ambas
      p1 build m 2x2
      p2 build m -2x5
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to set up with Xenos (three mines) without errors", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction xenos
      p1 build m 2x2
      p2 build m 3x0
      p2 build m 0x3
      p1 build m -7x2
      p2 build m 2x-3
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to set up with Ivits (PI as last player) without errors", () => {
    const moves = parseMoves(`  
      init 2 randomSeed
      p1 faction terrans
      p2 faction ivits
      p1 build m 2x2
      p1 build m 4x0
      p2 build PI -1x-1
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow players to pass", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster3
      p1 pass booster5
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should have passedPlayers empty at beginning of a new round", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster3
      p1 pass booster5
      p2 pass booster3
    `);

    const engine = new Engine(moves);
    expect(engine.passedPlayers).to.have.length(0);
  });
  
  it("should check wrong player order", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 4x0
      p2 build m 4x-2
      p2 build m -4x3
      p1 build m -7x2
      p2 booster booster2
      p1 booster booster3
      p1 build ts 4x0
      p2 build ts -4x3
      p2 pass booster5
    `);
    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it ("should allow players to upgrade a mine to a TS, either isolated or not", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 4x0
      p2 build m 4x-2
      p2 build m -4x3
      p1 build m -7x2
      p2 booster booster2
      p1 booster booster3
      p1 build ts 4x0
      p2 leech 1
      p2 build ts -4x3  
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  // TODO we should check resources after upgrading
  // TODO test to do: bescods upgrade 
  // TODO test to do: uprgrade to RL an AC1 AC2, to PI
  
  it ("should throw when upgrading without resources", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m -7x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 2x2
      p2 booster booster2
      p1 booster booster3
      p1 build ts 2x2
      p2 build ts 0x3
      p1 build PI 2x2
      p2 build PI 0x3
      p1 build ts -7x2
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it ("should allow a full round to pass", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster3
      p1 build ts 2x2
      p2 leech 1
      p2 pass booster5
      p1 build ts 4x0
      p2 leech 1
      p1 pass booster2
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it ("should throw when building out of range", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction gleens
      p1 build m 2x2
      p2 build m 0x3
      p2 build m 3x0
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster3
      p1 build m -7x2
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it ("should not spend a qic when building a mine nearby", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m 2x2
      p2 build m -1x3
      p2 build m -3x0
      p1 build m 4x-6
      p2 booster booster2
      p1 booster booster3
      p1 up nav
    `);

    const engine = new Engine(moves);

    expect(engine.player(Player.Player2).data.qics).to.equal(1);

    engine.move("p2 build m 0x3");

    expect(engine.player(Player.Player2).data.qics).to.equal(1);
  });

  it ("should grant a qic when upgrading navigation", () => {
    const moves = parseMoves(`
      init 3 randomSeed
      p1 faction lantids
      p2 faction taklons
      p3 faction hadsch-hallas
      p1 build m -3x3
      p2 build m 3x3
      p3 build m -2x3
      p3 build m 1x-1
      p2 build m -5x4
      p1 build m 2x2
      p3 booster booster1
      p2 booster booster2
      p1 booster booster3
    `);

    const engine = new Engine(moves);

    expect(engine.players[Player.Player1].data.qics).to.equal(2);
    
    engine.move("p1 up nav");

    expect(engine.players[Player.Player1].data.qics).to.equal(3);
  });

  it("should allow to place a gaia former and next round checks for transformation to gaia planet, pass is checking booster availablity", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 2x2
      p2 build m 4x-2
      p2 build m 2x-2
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster3
      p1 build gf 3x1
      p2 pass booster5
      p1 pass booster2
      p2 build ts 4x-2
      p1 leech 1
    `);
 
    const engine = new Engine(moves);

    const qicCount = engine.player(Player.Player1).data.qics;

    engine.move("p1 build m 3x1");

    expect(engine.player(Player.Player1).data.qics).to.equal(qicCount, "Building a mine from a gaia former doest NOT need a qic");
  });

  it ("should allow to upgrade research area after building a RL, pick tech in terra", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 4x0
      p2 build m 4x-2
      p2 build m 2x-2
      p1 build m 2x2
      p2 booster booster2
      p1 booster booster3
      p1 build ts 4x0
      p2 leech 1
      p2 build ts 4x-2
      p1 decline
      p1 build lab 4x0
      p1 tech terra
      p1 up terra
    `);
 
    expect(() => new Engine(moves)).to.not.throw();
  });

  it ("should work when upgrading research area after building a RL, pick tech in nav", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 4x0
      p2 build m 4x-2
      p2 build m 2x-2
      p1 build m 2x2
      p2 booster booster2
      p1 booster booster3
      p1 build ts 4x0
      p2 leech 1
      p2 build ts 4x-2
      p1 decline
      p1 build lab 4x0
      p1 tech nav
      p1 up nav
    `);
 
    expect(() => new Engine(moves)).to.not.throw();
  });
  
  it("should throw when picking tech in nav & upgrading gaia", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 4x0
      p2 build m 4x-2
      p2 build m 2x-2
      p1 build m 2x2
      p2 booster booster2
      p1 booster booster3
      p1 build ts 4x0
      p2 leech 1
      p2 build ts 4x-2
      p1 decline
      p1 build lab 4x0
      p1 tech nav
      p1 up gaia
    `);
 
    expect(() => new Engine(moves)).to.throw();
  });

  it ("should allow to form a federation and gain rewards", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction ambas
      p1 build m 2x2
      p2 build m -6x2
      p2 build m 3x-4
      p1 build m 4x-6
      p2 booster booster2
      p1 booster booster7
      p1 build ts 4x-6
      p2 leech 1
      p2 up terra
      p1 up gaia
      p2 build ts 3x-4
      p1 leech 2
      p1 build gf 4x-7
      p2 build PI 3x-4
      p1 leech 2
      p1 build lab 4x-6
      p1 tech gaia
      p1 up gaia
      p2 leech 3
      p2 build m 2x-3
      p1 pass booster3
      p2 pass booster7
      p1 build m 4x-7
      p2 build m 2x-2
      p1 build ac2 4x-6
      p1 tech free1
      p1 up nav
      p2 leech 3
      p2 pass booster10
      p1 pass booster2
      p2 build ts 2x-3
      p1 up nav
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player2).data;
    const vp = data.victoryPoints;
    const powerTokens = data.discardablePowerTokens();
    engine.move("p2 federation -1x0,-2x0,-3x1,-4x2,-5x2,-6x2,0x-1,1x-2,2x-2,2x-3,3x-4 fed2");
    expect(data.victoryPoints).to.equal(vp+8);
    expect(data.power.gaia).to.be.gte(0);
    expect(data.discardablePowerTokens()).to.be.equal(powerTokens-7, "The 7 satellites should remove one power token each");
  });

  it("should allow leech and burn power", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m 2x2
      p2 build m 4x-2
      p2 build m 2x-2
      p1 build m 4x0
      p2 booster booster2
      p1 booster booster5
      p1 build ts 4x0
      p2 leech 1
      p2 burn 1
    `);
 
    expect(() => new Engine(moves)).to.not.throw();
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

  describe("boosters", () => {
    it("should have the correct number of round boosters depending on the number of players", () => {
      const engine2 = new Engine(['init 2 randomSeed']);
      const engine3 = new Engine(['init 3 randomSeed']);
      const engine4 = new Engine(['init 4 randomSeed']);
      const engine5 = new Engine(['init 5 randomSeed']);
  
      expect(Object.keys(engine2.roundBoosters)).to.have.length(5);
      expect(Object.keys(engine3.roundBoosters)).to.have.length(6);
      expect(Object.keys(engine4.roundBoosters)).to.have.length(7);
      expect(Object.keys(engine5.roundBoosters)).to.have.length(8);
    });

    it("should allow to select round boosters without errors", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction lantids
        p2 faction gleens
        p1 build m 2x2
        p2 build m 0x3
        p2 build m 3x0
        p1 build m 4x0
        p2 booster booster2
        p1 booster booster3
        p1 pass booster5
      `);
  
      expect(() => new Engine(moves)).to.not.throw();
    });

    it("should throw when selecting invalid round booster", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction lantids
        p2 faction gleens
        p1 build m 2x2
        p2 build m 0x3
        p2 build m 3x0
        p1 build m 4x0
        p2 booster booster2
        p1 booster booster1
      `);
  
      expect(() => new Engine(moves)).to.throw(AssertionError);
    });

    it("should throw when selecting taken round booster", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction lantids
        p2 faction gleens
        p1 build m 2x2
        p2 build m 0x3
        p2 build m 3x0
        p1 build m 4x0
        p2 booster booster2
        p1 booster booster2
      `);
  
      expect(() => new Engine(moves)).to.throw(AssertionError);
    });

    it("should gain 2 victory points when upgrading to ts and having booster7", () => {
      //booster7: ["o", "ts | 2vp"]
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction ambas
        p1 build m 2x2
        p2 build m -6x2
        p2 build m 3x-4
        p1 build m 4x-6
        p2 booster booster2
        p1 booster booster7
      `);

      const engine = new Engine(moves);
      const vp = engine.player(Player.Player1).data.victoryPoints;
      
      engine.move("p1 build ts 4x-6");
      engine.move("p2 decline");
      engine.move("p2 pass booster3");
      engine.move("p1 pass booster2");

      expect(engine.player(Player.Player1).data.victoryPoints).to.equal(vp+2);
    });
  });
});

function parseMoves(moves: string) {
  return moves.trim().split("\n").map(move => move.trim());
}