import { expect } from "chai";
import Engine from "..";
import { AssertionError } from "assert";
import { Player, Federation } from "./enums";

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

  it("should allow players to upgrade a mine to a TS, either isolated or not", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -1x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x-1
      p2 booster booster7
      p1 booster booster3
      p1 build ts -1x2.
      p2 leech 1
      p2 build ts 0x-4  
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

  it("should allow to upgrade research area after building a RL, pick tech in nav", () => {
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
      p1 build ts -1x2.
      p2 pass booster5
      p1 build lab -1x2. tech nav.
    `);
 
    expect(() => new Engine(moves)).to.not.throw();
  });

  it ("should allow to form a federation and gain rewards", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -1x2
      p2 build m -1x-1
      p2 build m 3x-2
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster7
      p1 up gaia.
      p2 build ts -1x-1.
      p1 build gf -2x3.
      p2 build m -1x0.
      p1 leech 1
      p1 build ts -1x2.
      p2 leech 1
      p2 build m 1x0.
      p1 leech 2
      p1 build m -3x4.
      p2 pass booster8
      p1 build PI -1x2.
      p2 leech 1
      p1 pass booster3
      p2 burn 3. spend 3pw for 1o. pass booster5
      p1 build m -2x3.spend 1pw for 1c.spend 1pw for 1c.
      p1 build ts -4x2.
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player1).data;
    const vp = data.victoryPoints;
    const powerTokens = data.discardablePowerTokens();
    engine.move("p1 federation -1x2,-2x3,-3x2,-3x3,-3x4,-4x2 fed2");
    expect(data.victoryPoints).to.equal(vp+8);
    expect(data.power.gaia).to.be.gte(0);
    expect(data.discardablePowerTokens()).to.be.equal(powerTokens-2, "The 2 satellites should remove one power token each");
  });

  it("should allow poweraction", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -1x2
      p2 build m -1x-1
      p2 build m 3x-2
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster7
      p1 up gaia.
      p2 build ts -1x-1.
      p1 build m -1x0.
      p2 leech 2
      p2 burn 3. action power7
    `);
 
    expect(() => new Engine(moves)).to.not.throw();
  });

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

    const ore = engine.player(Player.Player2).data.ores;

    engine.move("p2 up nav");

    expect(engine.player(Player.Player2).data.ores).to.equal(ore + 1);
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
      p1 leech 1
      p1 build m -4x2.
      p2 build PI -5x5.
      p1 leech 1
    `);
 
    const engine = new Engine(moves);
    const data = engine.player(Player.Player2).data;
   
    expect(data.federations.includes(Federation.FederationGleens)).to.be.true;
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
  
      expect(() => new Engine(moves)).to.throw(AssertionError);
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
  
      expect(() => new Engine(moves)).to.throw(AssertionError);
    });

    it("should allow to do free actions after main actions", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction nevlas
        p1 build m -1x2
        p2 build m -1x0
        p2 build m 0x-4
        p1 build m -4x2
        p2 booster booster4
        p1 booster booster7
        p1 build ts -1x2. burn 1. burn 1.
        p2 leech 1
        p2 build ts -1x0. burn 1
      `);
  
      expect(() => new Engine(moves)).to.not.throw(AssertionError);
    });

    it("should gain 2 victory points when upgrading to ts and having booster7", () => {
      //booster7: ["o", "ts | 2vp"]
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
        p1 leech 1
        p1 pass booster4
      `);

      const engine = new Engine(moves);
      const vp = engine.player(Player.Player1).data.victoryPoints;
      
      engine.move("p2 pass booster3");
      
      expect(engine.player(Player.Player2).data.victoryPoints).to.equal(vp+2);
    });
  });
});

function parseMoves(moves: string) {
  return moves.trim().split("\n").map(move => move.trim());
}