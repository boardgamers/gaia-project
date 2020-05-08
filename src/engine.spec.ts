import { expect } from "chai";
import Engine from "./engine";
import { AssertionError } from "assert";
import { Player, Federation, Operator, AdvTechTilePos, Building, Condition, BrainstoneArea, Phase, Command, Faction } from "./enums";

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


  it("should export playerToMove in JSON", () => {
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

    const engine = new Engine(moves);
    const jsoned = JSON.parse(JSON.stringify(engine));
    expect(jsoned.playerToMove).to.equal(1);
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

  it("should handle this full 2 player game", function() {
    this.timeout(10000);
    const engine = new Engine(fullGame(), {noFedCheck: true});

    expect(engine.player(Player.Player1).data.victoryPoints).to.equal(130);
    expect(engine.player(Player.Player2).data.victoryPoints).to.equal(124);
  });

  it ("should be able to load/save state", function() {
    this.timeout(10000);
    let state: any = null;
    const baseLine = new Engine([], {noFedCheck: true});
    const moveList = fullGame();

    for (const move of moveList.slice(0, moveList.length - 1)) {
      baseLine.move(move);
      if (!state) {
        const engine = new Engine([move], {noFedCheck: true});
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

  it("should be able to load state from an empty game", () => {
    expect(() => Engine.fromData(JSON.parse(JSON.stringify(new Engine())))).to.not.throw();
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

  it ("should add a mine to a federation through a nearby satellite", () => {
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

  it ("should give step vps", () => {
    const moves = parseMoves(`
      init 2 SGAMBATA
      p1 faction nevlas
      p2 faction terrans
      nevlas build m -4x0
      terrans build m -3x-2
      terrans build m 1x-1
      nevlas build m 3x3
      terrans booster booster9
      nevlas booster booster5
      nevlas build ts -4x0.
      terrans charge 1pw
      terrans build ts -3x-2.
      nevlas charge 2pw
      nevlas build PI -4x0.
      terrans charge 2pw
      terrans build PI -3x-2.
      nevlas charge 3pw
      nevlas special range+3. build m -1x-3.
      terrans charge 3pw
      terrans up terra.
      nevlas action power5.
      terrans action power4.
      nevlas action power3.
      terrans build ts 1x-1.
      nevlas pass booster3
      terrans spend 1pw for 1c. spend 1pw for 1c. build gf 1x-2.
      terrans pass booster8
      nevlas income 4pw
      terrans income 1t
      terrans spend 3tg for 1o. spend 3tg for 1o
      nevlas up nav.
      terrans build lab 1x-1. tech free3. up terra.
      nevlas up nav.
      terrans build m 1x-2.
      nevlas build m 3x-4.
      terrans charge 1pw
      terrans action power5.
      nevlas build m 5x-4.
      terrans build gf -4x-2.
      nevlas build m 1x3.
      terrans up terra.
      nevlas burn 1. action power4.
      terrans spend 1pw for 1c. pass booster5
      nevlas pass booster9
      terrans income 1t
      nevlas income 4pw. income 4pw
      terrans spend 3tg for 1o. spend 3tg for 1o
      terrans action power5.
    `);
    const engine = new Engine(moves);
    const vps = engine.player(Player.Player1).data.victoryPoints;
    engine.move('nevlas action power6. build m -1x3.');
    expect(  engine.player(Player.Player1).data.victoryPoints ).to.be.equal(vps + 2 );
    expect(  engine.player(Player.Player1).data.temporaryStep ).to.be.equal(0 );
  });

  describe("autoChargePower", () => {
    it ("should leech 1pw and not do anything on 2pw", () => {
      const moves = parseMoves(`
        init 2 SGAMBATA
        p1 faction nevlas
        p2 faction terrans
        nevlas build m -4x0
        terrans build m -3x-2
        terrans build m 1x-1
        nevlas build m 3x3
        terrans booster booster9
        nevlas booster booster5
        nevlas build ts -4x0.
      `);

      const engine = new Engine(moves);

      engine.generateAvailableCommandsIfNeeded();
      // tslint:disable-next-line no-unused-expression
      expect(engine.autoChargePower()).to.be.true;
      expect(engine.moveHistory.length).to.equal(moves.length + 1);
      expect(engine.moveHistory.slice(-1).pop()).to.equal("terrans charge 1pw");

      /* Test with 2pw leech */
      engine.move('terrans build ts -3x-2.');
      // tslint:disable-next-line no-unused-expression
      expect(engine.autoChargePower()).to.be.false;
      expect(engine.moveHistory.length).to.equal(moves.length + 2);
    });

    it ("should not leech 1pw when brainstone may move", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction taklons
        terrans build m -4x-1
        taklons build m -3x-2
        taklons build m -6x3
        terrans build m -4x2
        taklons booster booster3
        terrans booster booster4
        terrans build ts -4x-1.
      `);

      const engine = new Engine(moves);

      // tslint:disable-next-line no-unused-expression
      expect(engine.autoChargePower()).to.be.false;
      expect(engine.moveHistory.length).to.equal(moves.length);
      expect(engine.player(Player.Player2).data.power.area1).to.equal(2);
      expect(engine.player(Player.Player2).data.power.area2).to.equal(4);
      expect(engine.player(Player.Player2).data.brainstone).to.equal(BrainstoneArea.Area1);
      expect(engine.player(Player.Player2).data.leechPossible).to.equal(1);
      // tslint:disable-next-line no-unused-expression
      expect(engine.findAvailableCommand(Player.Player2, Command.ChargePower)).to.not.be.undefined;
    });

    it ("should leech 2pw when player's auto charge value is 2", () => {
      const moves = parseMoves(`
        init 2 SGAMBATA
        p1 faction nevlas
        p2 faction terrans
        nevlas build m -4x0
        terrans build m -3x-2
        terrans build m 1x-1
        nevlas build m 3x3
        terrans booster booster9
        nevlas booster booster5
        nevlas build ts -4x0.
        terrans charge 1pw
        terrans build ts -3x-2.
      `);

      const engine = new Engine(moves);

      engine.generateAvailableCommandsIfNeeded();
      engine.player(Player.Player1).data.autoChargePower = 2;

      // tslint:disable-next-line no-unused-expression
      expect(engine.autoChargePower()).to.be.true;
      expect(engine.moveHistory.length).to.equal(moves.length + 1);
      expect(engine.moveHistory.slice(-1).pop()).to.equal("nevlas charge 2pw");
    });
  });

  describe("advanced logs", () => {
    it("pass move should appear before new round move", () => {
      const moves = parseMoves(`
        init 2 Alex-Del-Pieroooooo
        p1 faction xenos
        p2 faction firaks
        xenos build m 3x0
        firaks build m 4x-3
        firaks build m 5x-5
        xenos build m -2x2
        xenos build m 4x-7
        firaks booster booster4
        xenos booster booster5
      `);

      const engine = new Engine(moves);
      const log = engine.advancedLog.slice(-6);

      expect(log[0].move).to.equal(9);
      expect(log[1].round).to.equal(1);
      expect(log[2].phase).to.equal(Phase.RoundIncome);
      // tslint:disable-next-line no-unused-expression
      expect(log[3].move).to.be.undefined;
      // tslint:disable-next-line no-unused-expression
      expect(log[4].move).to.be.undefined;
      expect(log[5].phase).to.equal(Phase.RoundGaia);
    });
  });
});

describe("auction", () => {
  it ("should allow auction, everyone is fine wiht the current", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid geodens 1
        p2 bid itars 1
    `);
    const engine = new Engine(moves, {auction: true});

    expect(engine.players[0].faction).to.equal(Faction.Geodens);
    expect(engine.players[1].faction).to.equal(Faction.Itars);


  });

  it ("should allow auction, geodens are good", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid geodens 1
        p2 bid geodens 2
        p1 bid geodens 3
        p2 bid geodens 4
        p1 bid itars 1
    `);

    const engine = new Engine(moves, {auction: true});

    expect(engine.players[1].data.bid).to.equal(4);
    expect(engine.players[0].data.bid).to.equal(1);
    expect(engine.players[0].faction).to.equal(Faction.Itars);
    expect(engine.players[1].faction).to.equal(Faction.Geodens);
  });

  it ("should allow auction, everyone is fine wiht the current", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 0
        p2 bid geodens 0
    `);

    expect(() => new Engine(moves, {auction: true})).to.not.throw();
  });

  it ("should throw, wrong bid", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 0
        p2 bid itars 0
    `);

    expect(() => new Engine(moves, {auction: true})).to.throw();
  });


  it ("should allow auction, 3 players", () => {
    const moves = Engine.parseMoves(`
        init 3 djfjjv4k
        p1 faction geodens
        p2 faction taklons
        p3 faction itars
        p1 bid geodens 1
        p2 bid geodens 2
        p3 bid taklons 1
        p1 bid geodens 3
        p2 bid geodens 4
        p1 bid geodens 5
        p2 bid taklons 2
        p3 bid geodens 6
        p1 bid itars 1
    `);

    const engine = new Engine(moves, {auction: true});

    expect(engine.players[2].data.bid).to.equal(6)
    expect(engine.players[1].data.bid).to.equal(2) 
    expect(engine.players[0].data.bid).to.equal(1) 

    expect(engine.players[0].faction).to.equal(Faction.Itars);
    expect(engine.players[1].faction).to.equal(Faction.Taklons);
    expect(engine.players[2].faction).to.equal(Faction.Geodens);

  });

  it ("should throw auction, faction is not in list", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 1
        p2 bid terrans 1
    `);

    expect(() => new Engine(moves, {auction: true})).to.throw();
  });

  it ("should throw auction, bid is wrong", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 1
        p2 bid itars 1
    `);

    expect(() => new Engine(moves, {auction: true})).to.throw();
  });

  it ("should throw auction, bid is not in the range", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 1
        p2 bid itars 12
    `);

    expect(() => new Engine(moves, {auction: true})).to.throw();
  });

  it ("should support auction and then go to building phase", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction geodens
      p1 bid terrans 1
      p2 bid terrans 2
      p1 bid terrans 3
      p2 bid terrans 4
      p1 bid geodens 1
      terrans build m -4x2
    `);

    expect(() => new Engine(moves, {auction: true})).to.not.throw();
  });

  it ("should throw because players are bidding in the wrong order", () => {
    const moves = Engine.parseMoves(`
      init 4 djfjjv4k
      p1 faction geodens
      p2 faction taklons
      p3 faction itars
      p4 faction terrans
      p1 bid itars 1
      p2 bid terrans 1
      p3 bid itars 2
      p4 bid terrans 2
      p2 bid terrans 3
    `);

    expect(() => new Engine(moves, {auction: true})).to.throw();
  });


  it ("should allow auction, 4 players, right turn order", () => {
    const moves = Engine.parseMoves(`
        init 4 djfjjv4k
        p1 faction geodens
        p2 faction taklons
        p3 faction itars
        p4 faction terrans
        p1 bid itars 1
        p2 bid terrans 1
        p3 bid itars 2
        p4 bid terrans 2
        p1 bid geodens 1
        p2 bid terrans 3
        p4 bid taklons 1
    `);

    const engine = new Engine(moves, {auction: true});

    expect(engine.players[0].faction).to.equal(Faction.Geodens);
    expect(engine.players[1].faction).to.equal(Faction.Terrans);
    expect(engine.players[2].faction).to.equal(Faction.Itars);
    expect(engine.players[3].faction).to.equal(Faction.Taklons);

  });

  it ("should throw , wrong leech order based on auction setup", () => {
    const moves = Engine.parseMoves(`
      init 3 randomSeed
      p1 faction terrans
      p2 faction geodens
      p3 faction ambas
      p1 bid ambas 0
      p2 bid geodens 0
      p3 bid terrans 0
      terrans build m -1x-4
      geodens build m -3x-4
      ambas build m -2x-2
      ambas build m -5x3
      geodens build m -4x1
      terrans build m -5x4
      ambas booster booster1
      geodens booster booster2
      terrans booster booster3
      terrans build ts -1x-4.
      ambas charge 1pw
    `);

    expect(() => new Engine(moves, {auction: true})).to.throw();
    
  });
});

function parseMoves(moves: string) {
  return Engine.parseMoves(moves);
}

function fullGame() {
  return parseMoves(`
    init 2 djfjjv4k
    p1 faction geodens
    p2 faction itars
    geodens build m 1x-1
    itars build m 1x-2
    itars build m -6x2
    geodens build m 0x4
    itars booster booster4
    geodens booster booster1
    geodens build ts 1x-1.
    itars charge 1pw
    itars special step. build m -6x1.
    geodens build lab 1x-1. tech free1. up eco.
    itars charge 1pw
    itars build ts 1x-2.
    geodens charge 2pw
    geodens build m 2x-3.
    itars charge 2pw
    itars build lab 1x-2. tech int. up int.
    geodens charge 2pw
    geodens up eco.
    itars special 4pw.
    geodens build ts 2x-3.
    itars charge 2pw
    itars up gaia.
    geodens pass booster5
    itars build gf 4x-3.
    itars pass booster3
    geodens build PI 2x-3.
    itars charge 2pw
    itars special 4pw.
    geodens action power6. build m 0x5.
    itars build m 4x-3.
    geodens charge 3pw
    geodens up eco.
    itars build m -3x-2.
    geodens action power3.
    itars build ts 4x-3.
    geodens charge 3pw
    geodens pass booster4
    itars build gf -1x-2.
    itars pass booster5
    geodens income 1t
    itars income 1t
    geodens spend 4pw for 1q. special step. build m -1x0.
    itars charge 2pw
    itars special 4pw.
    geodens up terra.
    itars action power4.
    geodens build ts -1x0.
    itars charge 2pw
    itars build PI 4x-3.
    geodens charge 3pw
    geodens build lab -1x0. tech int. up int.
    itars charge 2pw
    itars burn 4. action power3.
    geodens special 4pw.
    itars special range+3. build m 5x-7.
    geodens spend 1pw for 1c. spend 1pw for 1c. spend 1pw for 1c. pass booster1
    itars up int.
    itars build m -1x-2.
    geodens charge 2pw
    itars build gf -3x0.
    itars pass booster10
    geodens income 1t
    itars income 1t. income 1t
    itars spend 4tg for tech. tech free1. up terra. spend 4tg for tech. tech terra. up terra
    geodens action power2. build m 4x-2.
    itars decline
    itars special 4pw.
    geodens up terra.
    itars action power4.
    geodens build ts 4x-2.
    itars decline
    itars build m -3x0.
    geodens charge 2pw
    geodens special 4pw.
    itars build ts -3x0.
    geodens charge 1pw
    geodens spend 4pw for 1q. action power6. build m -3x-1.
    itars decline
    itars build lab -3x0. tech free2. up int.
    geodens charge 2pw
    geodens federation 1x-1,2x-2,2x-3,3x-2,4x-2 fed4.
    itars federation -1x-2,0x-2,1x-2,2x-2,3x-2,4x-3 fed3.
    geodens up eco.
    itars pass booster3
    geodens build lab 4x-2. tech adv-eco. cover int. up terra.
    itars charge 4pw
    geodens pass booster5
    itars income 1pw. income 1t. income 1t
    geodens income 1t
    itars action power4.
    geodens spend 4pw for 1q. special range+3. build m -4x2.
    itars decline
    itars up int.
    geodens up nav.
    itars build m 4x-5.
    geodens charge 3pw
    geodens up nav.
    itars build m -3x4.
    geodens action power6. build m -2x5.
    itars charge 1pw
    itars special 4pw.
    geodens build m -4x6.
    itars charge 1pw
    itars burn 1. action power3.
    geodens build m 0x1.
    itars build ac2 -3x0. tech free3. up int.
    geodens charge 2pw
    geodens pass booster4
    itars action qic2. fedtile fed3.
    itars special q.
    itars build m 5x-1.
    geodens decline
    itars up terra.
    itars build gf 4x0.
    itars pass booster10
    geodens income 1t
    itars income 1t. income 1t
    itars spend 4tg for tech. tech gaia. up gaia
    geodens action power2. build m -1x3.
    itars charge 1pw
    itars special 4pw.
    geodens federation -1x0,-1x1,-1x2,-1x3,-1x4,-2x5,0x1,0x4,0x5 fed5.
    itars special q.
    geodens build ts -4x2.
    itars decline
    itars federation -3x-2,-3x0,-4x-1,-4x0,-5x1,-6x1,-6x2 fed2.
    geodens up terra.
    itars action qic2. fedtile fed2.
    geodens up nav.
    itars build ts 5x-1.
    geodens charge 2pw
    geodens build ts -3x-1.
    itars charge 3pw
    itars action power3.
    geodens up eco.
    itars build lab 5x-1. tech adv-int. cover gaia. up gaia.
    geodens action power7.
    itars build m 4x0.
    geodens decline
    geodens special step. build m -7x4.
    itars charge 1pw
    itars spend 1pw for 1c. build ts 4x0.
    geodens decline
    geodens build ts -7x4.
    itars charge 1pw
    itars burn 1. spend 1pw for 1c. spend 1pw for 1c. build m 3x0.
    geodens decline
    geodens spend 1pw for 1c. spend 1pw for 1c. federation -3x-1,-4x0,-4x1,-4x2,-4x3,-4x4,-4x5,-4x6,-5x3,-6x3,-7x4 fed4.
    itars pass
    geodens pass
  `);
}
