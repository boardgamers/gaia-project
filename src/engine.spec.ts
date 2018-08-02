import { expect } from "chai";
import Engine from "./engine";
import { AssertionError } from "assert";
import { Player, Federation, Operator, AdvTechTilePos, Building, Condition } from "./enums";

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
      nevlas charge 1pw
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
      p2 charge 1pw
      p4 charge 1pw
      p2 build ts 1x5.
      p4 charge 1pw
      p1 charge 2pw
      p3 build ts -4x1.
      p2 charge 1pw
      p4 build ts 1x4.
      p1 charge 2pw
      p2 charge 2pw
      p1 build m -6x6.
      p2 burn 1. build lab 1x5. tech int. up int. spend 1pw for 1c.
      p4 decline
      p1 decline
      p3 build lab -4x1. tech terra. up terra.
      p2 charge 1pw
      p4 build lab 1x4. tech sci. up sci. burn 2.
      p1 charge 2pw
      p2 decline
      p1 build gf -6x7. spend 1o for 1c.
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should handle this full 2 player game with lost planet", () => {
    const engine = new Engine(fullGame());

    expect(engine.player(Player.Player1).data.victoryPoints).to.equal(27);
    expect(engine.player(Player.Player2).data.victoryPoints).to.equal(23);
  });

  it ("should be able to load/save state", function() {
    this.timeout(10000);
    let state: any = null;
    const baseLine = new Engine();
    const moveList = fullGame();

    for (const move of moveList.slice(0, moveList.length - 1)) {
      baseLine.move(move);
      if (!state) {
        const engine = new Engine([move]);
        state = JSON.parse(JSON.stringify(engine));
      } else {
        const engine = Engine.fromData(state);
        engine.move(move);
        state = JSON.parse(JSON.stringify(engine));
      }

      expect(state.players[Player.Player1].data.knowledge).to.equal(baseLine.players[Player.Player1].data.knowledge, "Error loading move " + move);
      expect(state.players[Player.Player2].income).to.equal(baseLine.players[Player.Player2].toJSON().income, "Error loading move " + move);
      expect(state.players[Player.Player2].events[Operator.Income].length).to.equal(baseLine.players[Player.Player2].events[Operator.Income].length, "Error loading move " + move);
      expect(state.players[Player.Player2].data.ores).to.equal(baseLine.players[Player.Player2].data.ores, "Error loading move " + move);
    }

    const endEngine = Engine.fromData(state);
    expect(endEngine.player(Player.Player1).data.victoryPoints).to.equal(baseLine.player(Player.Player1).data.victoryPoints);
    expect(endEngine.player(Player.Player2).data.victoryPoints).to.equal(baseLine.player(Player.Player2).data.victoryPoints);

    const lastMove = moveList.pop();
    endEngine.move(lastMove);
    baseLine.move(lastMove);
    expect(endEngine.player(Player.Player1).data.victoryPoints).to.equal(baseLine.player(Player.Player1).data.victoryPoints);
    expect(endEngine.player(Player.Player2).data.victoryPoints).to.equal(baseLine.player(Player.Player2).data.victoryPoints);
  });

  it("should not count gaiaformers in data.occupied when loading a game from state", () => {
    const moves = parseMoves(`
      init 3 12
      p1 faction nevlas
      p2 faction baltaks
      p3 faction gleens
      nevlas build m 0x1
      baltaks build m 1x3
      gleens build m -5x4
      gleens build m 2x0
      baltaks build m -2x-2
      nevlas build m -1x-2
      gleens booster booster3
      baltaks booster booster2
      nevlas booster booster7
      nevlas spend 1o for 1c. build ts 0x1.
      gleens charge 1pw
      baltaks spend 1gf for 1q. up sci.
      gleens up nav.
      nevlas build lab 0x1. tech sci. up sci.
      gleens charge 1pw
      baltaks build ts -2x-2.
      nevlas charge 1pw
      gleens build ts 2x0.
      nevlas charge 2pw
      nevlas special 4pw.
      baltaks build lab -2x-2. tech free2. up eco.
      nevlas charge 1pw
      gleens build lab 2x0. tech nav. up nav.
      nevlas action power3.
      baltaks build ts 1x3.
      gleens pass booster8
      nevlas up sci.
      baltaks pass booster1
      nevlas pass booster3
      gleens build m -4x2.
      baltaks build lab 1x3. tech sci. up sci.
      nevlas special 4pw.
      gleens build m -7x6.
      baltaks special 4pw.
      nevlas build ac1 0x1. tech free3. up sci.
      gleens charge 2pw
      gleens build m -8x8.
      baltaks up sci.
      nevlas up eco.
      gleens pass booster2
      baltaks action power3.
      nevlas pass booster7
      baltaks build gf 1x2.
      baltaks pass booster8
      gleens up nav.
      nevlas up nav.
      baltaks build m 1x2.
      gleens charge 2pw
      gleens action power4.
      nevlas action power3.
      baltaks build ts 1x2.
      gleens charge 2pw
      nevlas charge 3pw
      gleens build ts -8x8.
      nevlas build ts -1x-2.
      baltaks charge 2pw
      baltaks spend 1gf for 1q. pass booster3
      gleens spend 1pw for 1c. burn 1. spend 1pw for 1c. build PI -8x8.
      nevlas special 4pw.
      gleens pass booster8
      nevlas build m -1x5.
      baltaks charge 2pw
      nevlas spend 1pw for 1c. spend 1pw for 1c. build ts -1x5.
      baltaks charge 2pw
      nevlas federation -1x-1,-1x-2,-1x0,-1x5,0x0,0x1,0x2,0x3,0x4 fed5.
      nevlas pass booster2
      nevlas income 1pw. income 1pw
      baltaks special 4pw.
    `);

    // This would throw if the gaia former was in data.occupied, since it would
    // be part of the buildings for available federations (adjacent to another building)
    // and part of the excluded hexes at the same time
    expect(() => Engine.slowMotion(moves)).to.not.throw();
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
      p2 charge 1pw
      p2 build ts -1x0.
      p1 charge 2pw
      p1 build lab -1x2. tech gaia. up gaia.
      p2 charge 2pw
      p2 up gaia.
      p1 up gaia.
      p2 spend 1o for 1t. build gf -3x1. burn 2.
      p1 pass booster5
      p2 build PI -1x0.
      p1 charge 2pw
      p2 pass booster4
    `);

    expect(() => new Engine([...moves, "p2 income 1t,1t. income 1t"])).to.throw();
    expect(() => new Engine([...moves, "p2 income 1t,1t"])).to.not.throw();
  });

  it ("should add a mine to a federation through a nearby satellite", function() {
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
      p1 charge 1pw
      p1 build ts -1x2.
      p2 charge 1pw
      p2 build m 1x0.
      p1 charge 2pw
      p1 build m -3x4.
      p2 pass booster8
      p1 build PI -1x2.
      p2 charge 1pw
      p1 pass booster3
      p1 income t
      p1 spend 4tg for 1k. spend 2tg for 2c
      p2 burn 3. spend 3pw for 1o. pass booster5
      p1 build m -2x3. spend 2pw for 2c.
      p1 build ts -4x2.
      terrans federation -4x4,-4x3,-4x2,-3x4,-2x3,-1x2 fed4.
      terrans pass booster7
      terrans income 4pw
      bescods pass booster4
    `);
    const engine = new Engine(moves);
    const structure = engine.player(Player.Player1).eventConditionCount(Condition.StructureFed);
    engine.move('terrans action power2. build m -5x5.');
    expect(  engine.player(Player.Player1).eventConditionCount(Condition.StructureFed) ).to.be.equal(structure + 1 );
  });
});

function parseMoves(moves: string) {
  return Engine.parseMoves(moves);
}

function fullGame() {
  return parseMoves(`
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
    p1 charge 1pw
    p1 build ts -3x4.
    p2 charge 1pw
    p2 build ts -5x5.
    p1 decline
    p1 build lab -3x4. tech free2. up gaia.
    p2 charge 2pw
    p2 build lab -5x5. tech free2. up nav.
    p1 decline
    p1 build gf -2x3.
    p2 up nav.
    p1 build ts -1x2.
    p2 action power3.
    p1 special 4pw.
    p2 special 4pw.
    p1 action power5.
    p2 build ts -2x2.
    p1 decline
    p1 build gf -3x1.
    p2 build m 1x2.
    p1 charge 2pw
    p1 pass booster4
    p2 pass booster3
    p1 special 4pw.
    p2 special 4pw.
    p1 up terra.
    p2 action power5.
    p1 action power3.
    p2 up nav.
    p1 build PI -1x2.
    p2 charge 2pw
    p2 spend 1pw for 1c. build PI -2x2.
    p1 decline
    p1 build m -2x3.
    p2 decline
    p2 federation -1x1,-2x2,-3x3,-4x4,-5x5,0x1,0x2,1x0,1x2 fed4. spend 1o for 1t.
    p1 build gf -5x6.
    p2 spend 1k for 1c. build ts 1x0.
    p1 charge 3pw
    p1 spend 3pw for 1o. burn 1. spend 3pw for 1o. build ts -2x3.
    p2 charge 2pw
    p2 spend 2pw for 2c. pass booster7
    p1 federation -1x2,-2x3,-3x4 fed6.
    p1 pass booster5
    p1 income 1t
    p1 spend 4tg for 1q
    p2 build lab 1x0. tech free3. up nav. lostPlanet 1x-4. spend 1pw for 1c. spend 1pw for 1c.
    p1 charge 3pw
    p1 up terra.
    p2 special 4pw. spend 1pw for 1c. spend 1pw for 1c.
    p1 build m -3x1.
    p2 charge 3pw
    p2 spend 1pw for 1c. spend 1o for 1t. pass booster3
    p1 special 4pw.
    p1 action power3.
    p1 special range+3. build gf 0x4.
    p1 spend 1pw for 1c. build m -5x6.
    p2 charge 2pw
    p1 burn 1. spend 2pw for 2c. build m -4x6.
    p2 decline
    p1 pass booster8
    p1 income 4pw
    p1 spend 4tg for 1k
    p2 spend 1o for 1t. special 4pw.
    p1 up terra.
    p2 action power3.
    p1 build m 0x4.
    p2 charge 1pw
  `);
}
