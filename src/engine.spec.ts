import { expect } from "chai";
import Engine from "..";
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
      p1 build m -1x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x-1
      p2 booster booster7
      p1 booster booster3
      p1 build ts -1x2.
      p2 leech 1pw
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

  it("should prevent upgrading to last research area without green a federation", () => {
    const moves = parseMoves(`
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
      p1 build gf -2x3.. special 4pw. spend 4pw for 1k.. pass booster7
      p2 action power5.
      p1 build m -2x3.
      p2 leech 3pw
      p2 up nav.
    `);

    const engine = new Engine(moves);

    expect(() => engine.move("p1 up gaia.")).to.throw();
  });

  it("should allow to form a federation and gain rewards. Gaia phase to test income for terrans", () => {
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
      p1 leech 1pw
      p1 build ts -1x2.
      p2 leech 1pw
      p2 build m 1x0.
      p1 leech 2pw
      p1 build m -3x4.
      p2 pass booster8
      p1 build PI -1x2.
      p2 leech 1pw
      p1 pass booster3
      p1 income t
      p1 spend 4tg for 1k. spend 2tg for 2c
      p2 burn 3. spend 3pw for 1o. pass booster5
      p1 build m -2x3. spend 2pw for 2c.
      p1 build ts -4x2.
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player1).data;
    const vp = data.victoryPoints;
    const powerTokens = data.discardablePowerTokens();
    engine.move("p1 federation -1x2,-2x3,-3x2,-3x3,-3x4,-4x2 fed2");
    // gets vp for federation and for fed building from roundbooster
    expect(data.victoryPoints).to.equal(vp + 8 + 5);
    expect(data.power.gaia).to.be.gte(0);
    expect(data.satellites).to.equal(2);
    expect(data.discardablePowerTokens()).to.be.equal(powerTokens - 2, "The 2 satellites should remove one power token each");

    // Test other federation with the same buildings
    expect(() => new Engine([...moves, "p1 federation -1x2,-2x3,-3x3,-3x4,-4x2,-4x3 fed2"])).to.not.throw();
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
      p2 leech 2pw
      p2 burn 3. action power7
    `);

    expect(() => new Engine(moves)).to.not.throw();
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

  it("should allow Taklons to leech with +t freeIncome", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction taklons
      p1 build m -4x-1
      p2 build m -3x-2
      p2 build m -6x3
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -4x-1.
      p2 leech 1pw
      p2 build ts -3x-2.
      p1 leech 2pw
      p1 build ts -4x2.
      p2 leech 1pw
      p2 build PI -3x-2.
      p1 leech 2pw
      p1 build lab -4x-1. tech gaia.
    `);

    expect(() => new Engine([...moves, "p2 leech 3pw,1t"])).to.not.throw();
    expect(() => new Engine([...moves, "p2 leech 1t,3pw"])).to.not.throw();
  });

  it("should allow Ambas to use piswap", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction nevlas
      p2 faction ambas
      p1 build m 2x2
      p2 build m 2x4
      p2 build m 5x-3
      p1 build m 3x-3
      p2 booster booster3
      p1 booster booster4
      p1 build ts 2x2.
      p2 leech 1pw
      p2 build ts 2x4.
      p1 leech 2pw
      p1 pass booster7
      p2 build PI 2x4.
      p1 leech 2pw
    `);

    expect(() => new Engine([...moves, "p2 special piswap. piswap 5x-3."])).to.not.throw();
    expect(() => new Engine([...moves, "p2 special piswap. piswap 3x-3."])).to.throw();
  });


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
        p1 leech 1pw
        p1 build m -4x2.
        p2 build PI -5x5.
        p1 leech 1pw
      `);

      const engine = new Engine(moves);
      const data = engine.player(Player.Player2).data;

      // tslint:disable-next-line no-unused-expression
      expect(data.federations.includes(Federation.FederationGleens)).to.be.true;
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

  describe("lantids", () => {
    it ("should be able to build a mine on other players' planets", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction lantids
        p2 faction xenos
        p1 build m -3x4
        p2 build m -2x2
        p2 build m -5x5
        p1 build m -1x2
        p2 build m 1x2
        p2 booster booster3
        p1 booster booster7
        p1 build m -2x2.
        p2 leech 1pw
      `);

      expect(() => new Engine(moves)).to.not.throw();
    });

    it ("should gain knowledge when having a PI and building on someone else's planet", () => {
      const engine = new Engine(parseMoves(`
        init 2 randomSeed
        p1 faction lantids
        p2 faction xenos
        p1 build m -3x4
        p2 build m -2x2
        p2 build m -5x5
        p1 build m -1x2
        p2 build m 1x2
        p2 booster booster3
        p1 booster booster7
      `));

      engine.player(Player.Player1).data[Building.PlanetaryInstitute] = 1;
      const k = engine.player(Player.Player1).data.knowledge;
      engine.move("p1 build m -2x2.");
      expect(engine.player(Player.Player1).data.knowledge).to.equal(k + 2);
    });
  });

  describe("nevlas", () => {
      it("should allow Nevlas to use action power using empowered tokens and free actions", () => {
        const engine = new Engine(parseMoves(`
          init 2 randomSeed
          p1 faction nevlas
          p2 faction gleens
          p1 build m -1x0
          p2 build m -2x2
          p2 build m 1x2
          p1 build m 2x2
          p2 booster booster4
          p1 booster booster3
          p1 build ts -1x0.
          p2 leech 1pw
          p2 build ts -2x2.
          p1 leech 2pw
          p1 build ts 2x2.
          p2 leech 1pw
          p2 build lab -2x2. tech terra.
          p1 leech 2pw
          p1 spend 1q for 1o. build PI -1x0.
          p2 leech 2pw
          p2 build ts 1x2.
          p1 leech 2pw
        `));

        const a3 = engine.player(Player.Player1).data.power.area3;
        const gaia = engine.player(Player.Player1).data.power.gaia;
        const know = engine.player(Player.Player1).data.knowledge;
        // power7 is 3 power
        engine.move('p1 action power7.');
        expect(engine.player(Player.Player1).data.power.area3).to.equal(a3 - 2);

        engine.move("p2 pass booster5");
        engine.move("p1 spend t-a3 for k. spend 1k for 1c. up sci. spend t-a3 for k");
        expect(engine.player(Player.Player1).data.power.gaia).to.equal(gaia + 2);
        expect(engine.player(Player.Player1).data.knowledge).to.equal(know + 1 - 1 - 4 + 1);
      });
  });

  describe("free actions", () => {
    it("should allow free action as first move after setupsetup is correct", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction nevlas
        p1 build m -4x-1
        p2 build m -1x0
        p2 build m 0x-4
        p1 build m -4x2
        p2 booster booster3
        p1 booster booster4
        p1 spend 1q for 1o
      `);

      expect(() => new Engine(moves)).to.not.throw();
    });

    it("should allow free actions to spend 1q for 1c", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction nevlas
        p1 build m -4x-1
        p2 build m -1x0
        p2 build m 0x-4
        p1 build m -4x2
        p2 booster booster3
        p1 booster booster4
        p1 spend 1q for 1c
      `);

      expect(() => new Engine(moves)).to.not.throw();
    });

    it("should prevent unreasonable free actions", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction nevlas
        p1 build m -4x-1
        p2 build m -1x0
        p2 build m 0x-4
        p1 build m -4x2
        p2 booster booster3
        p1 booster booster4
      `);

      const engine = new Engine(moves);

      expect(() => engine.move("p1 spend ~ for ~")).to.throw();
      expect(() => engine.move("p1 spend 1q for 2o")).to.throw();
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
        p1 build ts -1x2. burn 2.
        p2 leech 1pw
        p2 build ts -1x0. burn 1
      `);

      expect(() => new Engine(moves)).to.not.throw(AssertionError);
    });

    it("should grant hadsch hallas new free actions after the PI is built", () => {
      const moves = parseMoves(`
        init 2 randomSeed
        p1 faction hadsch-hallas
        p2 faction ambas
        p1 build m -5x0
        p2 build m -3x-2
        p2 build m 2x4
        p1 build m 1x5
        p2 booster booster3
        p1 booster booster7
        p1 build ts 1x5.
        p2 leech 1pw
        p2 build ts 2x4.
        p1 leech 2pw
        p1 build PI 1x5. spend 4c for 1k
      `);

      expect(() => new Engine(moves)).to.not.throw();
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
    }) ;

  });

  describe("tech tiles", () => {
    it("should prevent picking the same tech tile twice", () => {
      const moves = parseMoves(`
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

    it("should allow to get an advanced tech tiles when conditions are met", () => {
      const moves = parseMoves(`
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
        p1 build gf -2x3.. special 4pw. spend 4pw for 1k.. pass booster7
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
        p1 build lab -2x3. tech adv-gaia. cover free1. up gaia
      `);

      const engine = new Engine(moves);

      // tslint:disable-next-line no-unused-expression
      expect(engine.player(Player.Player1).data.advTechTiles.find(tile => tile.pos === AdvTechTilePos.GaiaProject)).to.not.be.undefined;
      expect(engine.advTechTiles[AdvTechTilePos.GaiaProject].numTiles).to.equal(0);
    });
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
        p1 leech 1pw
        p1 pass booster4
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

      // tslint:disable-next-line no-unused-expression
      expect(() => new Engine([...moves, "p1 special step"])).to.not.throw();
      // tslint:disable-next-line no-unused-expression
      expect(new Engine([...moves, "p1 special step"]).player(Player.Player1).events[Operator.Activate][0].activated).to.be.true;

      // test free action before and after, and to build something different then a mine
      expect(() => new Engine([...moves, "p1 special step. spend 1o for 1c. build m -1x-1. spend 1o for 1c."])).to.not.throw();
      expect(() => new Engine([...moves, "p1 special step. spend 1o for 1c. build ts -4x2"])).to.throw();
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
        p2 booster booster5
        p1 booster booster4
        p1 special step. spend 1o for 1c. build m -1x-1.
        p2 leech 1pw
        p2 special range+3. spend 1o for 1c. build m 3x-3.
      `);

      expect(() => new Engine(moves)).to.not.throw(AssertionError);
    });
  });
});

function parseMoves(moves: string) {
  return moves.trim().split("\n").map(move => move.trim());
}
