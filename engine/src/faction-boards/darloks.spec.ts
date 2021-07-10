import { expect } from "chai";
import { iteratee } from "lodash";
import { PlayerEnum } from "../..";
import AvailableCommand, {
  generate,
  possibleAdvancedTechsToSpy,
  possibleResearchAreas,
  possibleSpecialActions,
  possibleTechsToSpy,
  possibleTechTiles,
  UPGRADE_RESEARCH_COST,
} from "../available-command";
import Engine from "../engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  Command,
  Expansion,
  Federation,
  ResearchField,
  Resource,
  SubPhase,
  TechTilePos,
} from "../enums";
import { isBorrowed } from "../player-data";

describe("Darloks", () => {
  it("should not be able to spy on a tech tile if no one has one", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction darloks
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 pass booster8
    `);
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const specialActions = possibleSpecialActions(engine, engine.currentPlayer);
    expect(specialActions.length).to.equal(0);
  });

  describe("if another player takes a normal tech tile", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction darloks
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 build ts -4x2.
    p2 build ts -1x-1.
    p1 build lab -4x2. tech gaia. up gaia.
    `);
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });

    it("Darloks can spy on the tech", () => {
      const specialActions = possibleSpecialActions(engine, engine.currentPlayer);
      expect(specialActions.length).to.equal(1);
      const spyTech = specialActions[0].data.specialacts[0];
      expect(spyTech.income).to.equal(Resource.SpyTech);
    });

    it("Darloks cannot use their PI ability to spy on simple techs", () => {
      const techs = possibleAdvancedTechsToSpy(
        engine,
        engine.currentPlayer
      )[0] as AvailableCommand<Command.SpyAdvancedTech>;
      expect(techs.data.tiles.length).to.equal(0);
    });

    it("Darloks can decline the advanced tech if they build their PI", () => {
      const decline = possibleAdvancedTechsToSpy(engine, engine.currentPlayer)[1];
      expect(decline.name).to.equal(Command.Decline);
    });
  });

  it("should be not able to spy on a tech tile if they already have the same one", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction darloks
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 build ts -4x2.
    p2 build ts -1x-1.
    p1 build lab -4x2. tech gaia. up gaia.
    p2 build lab -1x-1. tech gaia. up gaia.
    p1 pass booster8
    `);
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const specialActions = possibleSpecialActions(engine, engine.currentPlayer);
    expect(specialActions.length).to.equal(0);
  });

  it("should be able to spy on a tech tile if they took a different one", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction darloks
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 build ts -4x2.
    p2 build ts -1x-1.
    p1 build lab -4x2. tech gaia. up gaia.
    p2 build lab -1x-1. tech eco. up eco.
    p1 pass booster8
    `);
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const specialActions = possibleSpecialActions(engine, engine.currentPlayer);
    expect(specialActions.length).to.equal(1);
    const spyTech = specialActions[0].data.specialacts[0];
    expect(spyTech.income).to.equal(Resource.SpyTech);
  });

  it("should not be able to spy on a covered tech tile", () => {
    const moves = [
      "init 2 debugger",
      "p1 faction nevlas",
      "p2 faction darloks",
      "nevlas build m 2B0",
      "darloks build m 2A10",
      "darloks build m 3A7",
      "nevlas build m 3B4",
      "darloks booster booster9",
      "nevlas booster booster1",
      "nevlas build ts 2B0.",
      "darloks charge 1pw",
      "darloks build ts 2A10.",
      "nevlas charge 2pw",
      "nevlas build PI 2B0.",
      "darloks charge 2pw",
      "darloks build m 4A4.",
      "nevlas charge 3pw",
      "nevlas build ts 3B4.",
      "darloks charge 1pw",
      "darloks build ts 4A4.",
      "nevlas charge 3pw",
      "nevlas action power3.",
      "darloks spend 3pw for 1o. build lab 4A4. tech terra. up terra (0 ⇒ 1).",
      "nevlas charge 3pw",
      "nevlas action power4.",
      "darloks up nav (0 ⇒ 1).",
      "nevlas  spend 6pw for 2o. build lab 3B4. tech sci. up sci (1 ⇒ 2).",
      "darloks charge 1pw",
      "darloks spend 1pw for 1c. spend 1pw for 1c. spend 1pw for 1c. spend 1q for 1o. build lab 2A10. tech free1. up nav (1 ⇒ 2).",
      "nevlas charge 3pw",
      "nevlas up sci (2 ⇒ 3).",
      "darloks pass booster3 returning booster9",
      "nevlas special 4pw.",
      "nevlas spend 1t-a3 for 1k. spend 1t-a3 for 1k. spend 1t-a3 for 1k. up sci (3 ⇒ 4).",
      "nevlas action power6. build m 3A11.",
      "nevlas pass booster5 returning booster1",
      "nevlas income 1t",
      "darloks build ts 3A7.",
      "nevlas charge 2pw",
      "nevlas up nav (0 ⇒ 1).",
      "darloks up nav (2 ⇒ 3).",
      "nevlas special range+3. build m 3B1.",
      "darloks pass booster1 returning booster3",
      "nevlas special 4pw.",
      "nevlas action power3.",
      "nevlas action power4.",
      "nevlas action power5.",
      "nevlas spend 1t-a3 for 1k. up nav (1 ⇒ 2).",
      "nevlas build ts 3B1.",
      "nevlas pass booster9 returning booster5",
      "nevlas income 4pw. income 2pw. income 4pw",
      "darloks up terra (1 ⇒ 2).",
      "nevlas special 4pw.",
      "darloks spend 1q for 1o. build m 4B4.",
      "nevlas spend 2pw for 2c. up nav (2 ⇒ 3).",
      "darloks pass booster8 returning booster1",
      "nevlas action power6. build m 4A8.",
      "darloks charge 1pw",
      "nevlas build ts 4A8.",
      "darloks charge 1pw",
      "nevlas action power3.",
      "nevlas spend 2pw for 2c. spend 2pw for 2c. federation 1A0,2A11,2B0,3A5,3B3,3B4,4A6,4A7,4A8 fed4 using area1: 6.",
      "nevlas build lab 4A8. tech adv-sci. cover sci. up terra (0 ⇒ 1).",
      "darloks charge 1pw",
      "nevlas pass booster3 returning booster9",
      "nevlas income 1t",
    ];
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    expect(() => engine.move("darloks special spy-tech. spy-tech nevlas sci.")).to.throw();
  });

  it("should offer to get the tech when the special move is initiated", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction darloks
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 build ts -4x2.
    p2 build ts -1x-1.
    p1 build lab -4x2. tech gaia. up gaia.
    `);
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const availableCommands = generate(engine, SubPhase.SpyTech);
    expect(availableCommands.length).to.equal(1);
    expect(availableCommands[0].name).to.equal(Command.SpyTech);
    expect(availableCommands[0].data.tiles.length).to.equal(1);
    expect(availableCommands[0].data.tiles[0].pos).to.equal(TechTilePos.GaiaProject);
    expect(availableCommands[0].data.tiles[0].player).to.equal(PlayerEnum.Player1);
  });

  it("should get the tech after spying on it", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction darloks
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 build ts -4x2.
    p2 build ts -1x-1.
    p1 build lab -4x2. tech gaia. up gaia.
    p2 special spy-tech. spy-tech p1 gaia.
    `);
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const p2 = engine.players[1];
    const techs = p2.data.tiles.techs;
    expect(techs.length).to.equal(1);
    expect(techs[0].pos).to.equal(TechTilePos.GaiaProject);
  });

  it("should return the tech after spying on a new one", () => {
    const moves = [
      "init 2 661",
      "p1 faction gleens",
      "p2 faction darloks",
      "gleens build m 1A9",
      "darloks build m 3A3",
      "darloks build m 4A0",
      "gleens build m 3A6",
      "darloks booster booster3",
      "gleens booster booster1",
      "gleens build ts 1A9.",
      "darloks charge 1pw",
      "darloks build ts 3A3.",
      "gleens charge 2pw",
      "gleens build lab 1A9. tech free3. up terra (0 ⇒ 1).",
      "darloks charge 2pw",
      "darloks special spy-tech. spy-tech gleens free3.",
      "gleens build ac1 1A9. tech nav. up nav (1 ⇒ 2).",
      "darloks charge 2pw",
      "darloks spend 3pw for 1o. special 4pw.",
      "gleens pass booster4 returning booster1",
      "darloks pass booster1 returning booster3",
      "gleens build m 6B3.",
      "darloks special 4pw.",
      "gleens up nav (2 ⇒ 3).",
      "darloks special spy-tech. spy-tech gleens nav.",
    ];
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion, factionVariant: "more-balanced" });
    const p2 = engine.players[1];
    const techs = p2.data.tiles.techs;
    const spiedTechs = techs.filter((t) => isBorrowed(t));
    expect(spiedTechs.length).to.equal(1);
    expect(spiedTechs[0].pos).to.equal("nav");
  });

  describe("when someone gains an advanced tile", () => {
    const moves = [
      "init 2 661",
      "p1 faction ivits",
      "p2 faction darloks",
      "darloks build m 4A0",
      "ivits build PI 1A6",
      "darloks build m 7A0",
      "darloks booster booster5",
      "ivits booster booster9",
      "ivits action power3.",
      "darloks build ts 4A0.",
      "ivits charge 3pw",
      "ivits special space-station. build sp 4A11.",
      "darloks build lab 4A0. tech free2. up nav (0 ⇒ 1).",
      "ivits charge 3pw",
      "ivits build m 4B0.",
      "darloks charge 2pw",
      "darloks special range+3. build m 6B3.",
      "ivits build ts 4B0.",
      "darloks charge 2pw",
      "darloks up nav (1 ⇒ 2).",
      "ivits build lab 4B0. tech free1. up sci (0 ⇒ 1).",
      "darloks charge 2pw",
      "darloks action power2. build m 6B1.",
      "ivits charge 2pw",
      "ivits action power5.",
      "darloks special spy-tech. spy-tech ivits free1.",
      "ivits federation 1A6,4A11,4B0 fed6.",
      "darloks pass booster3 returning booster5",
      "ivits up sci (1 ⇒ 2).",
      "ivits up sci (2 ⇒ 3).",
      "ivits burn 1. action power6. build m 1A5.",
      "darloks charge 2pw",
      "ivits pass booster1 returning booster9",
      "darloks build ts 6B1.",
      "ivits charge 4pw",
      "ivits up sci (3 ⇒ 4).",
      "darloks pass booster4 returning booster3",
      "ivits build ts 1A5.",
      "darloks charge 2pw",
      "ivits  spend 2q for 2o.  spend 1k for 1c.  spend 4pw for 4c. build lab 1A5. tech adv-sci. cover free1. up terra (0 ⇒ 1).",
      "darloks charge 2pw",
      "ivits pass booster3 returning booster1",
    ];
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion, factionVariant: "more-balanced" });

    it("and covers the spied tile, it should be disabled", () => {
      const p2 = engine.players[1];
      const techs = p2.data.tiles.techs;
      const spiedTechs = techs.filter((t) => isBorrowed(t));
      expect(spiedTechs.length).to.equal(1);
      expect(spiedTechs[0].enabled).to.equal(false);
    });

    it("and covers the spied tile, the same tile cannot be gained when building a lab", () => {
      const p2 = engine.players[1];
      const techs = possibleTechTiles(engine, p2.player);
      expect(techs.map((t) => t.pos)).to.not.contain(TechTilePos.Free1);
    });

    it("the advanced tile cannot be spied upon", () => {
      const p2 = engine.players[1];
      const techs = possibleTechsToSpy(engine, p2.player)[0] as AvailableCommand<Command.SpyTech>;
      expect(techs.data.tiles.length).to.equal(0);
      const specialActions = possibleSpecialActions(engine, p2.player)[0].data.specialacts;
      expect(specialActions.map((sa) => sa.name)).to.not.contain(Command.SpyTech);

      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      expect(() => newEngine.move("darloks special spy-tech. spy-tech ivits adv-sci.")).to.throw();
    });

    it("the advanced tile cannot be spied with the advanced tech because the Darloks have no green federation", () => {
      const p2 = engine.players[1];
      const techs = possibleAdvancedTechsToSpy(engine, p2.player)[0] as AvailableCommand<Command.SpyAdvancedTech>;
      expect(techs.data.tiles.length).to.equal(0);
    });

    it("and the Darloks build their PI, they can decline the advanced tech", () => {
      const p2 = engine.players[1];
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      expect(() => newEngine.move("darloks build PI 6B1. decline spy-advanced-tech.")).to.not.throw();
    });

    it("and the Darloks have a green federation, the advanced tech is spy-able", () => {
      const p2 = engine.players[1];
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move("darloks special step. build m 4A9.");
      newEngine.move("ivits charge 3pw");
      newEngine.move("ivits up nav (0 ⇒ 1).");
      newEngine.move("darloks federation 4A0,4A10,4A11,4A9,6A3,6A7,6B1,6B2,6B3,7A0,7A1 fed4 using area2: 4, area3: 2.");
      const techs = possibleAdvancedTechsToSpy(newEngine, p2.player)[0] as AvailableCommand<Command.SpyAdvancedTech>;
      expect(techs.data.tiles.length).to.equal(1);
      expect(techs.data.tiles[0].tile).to.equal(AdvTechTile.AdvTech12);
      expect(techs.data.tiles[0].pos).to.equal(AdvTechTilePos.Science);
      expect(techs.data.tiles[0].player).to.equal(PlayerEnum.Player1);
    });

    it("the Darloks can spy on it", () => {
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move("darloks special step. build m 4A9.");
      newEngine.move("ivits charge 3pw");
      newEngine.move("ivits up nav (0 ⇒ 1).");
      newEngine.move("darloks federation 4A0,4A10,4A11,4A9,6A3,6A7,6B1,6B2,6B3,7A0,7A1 fed4 using area2: 4, area3: 2.");
      newEngine.move("ivits up nav (1 ⇒ 2).");
      newEngine.move("darloks build PI 6B1. spy-advanced-tech ivits adv-sci.");
      const p2 = newEngine.players[1];
      expect(p2.data.tiles.techs.length).to.equal(3);
      expect(p2.data.tiles.techs[2].tile).to.equal(AdvTechTile.AdvTech12);
      expect(p2.data.tiles.techs[2].pos).to.equal(AdvTechTilePos.Science);
      expect(p2.data.tiles.techs[2].owner).to.equal(PlayerEnum.Player1);
    });
  });

  it("a covered tech tile cannot be spied upon", () => {
    const moves = [
      "init 2 debugger",
      "p1 faction xenos",
      "p2 faction darloks",
      "xenos build m 1A9",
      "darloks build m 7A0",
      "darloks build m 4A4",
      "xenos build m 2A1",
      "xenos build m 6A8",
      "darloks booster booster5",
      "xenos booster booster3",
      "xenos build ts 1A9.",
      "darloks charge 1pw",
      "darloks build ts 7A0.",
      "xenos charge 2pw",
      "xenos build lab 1A9. tech int. up int (1 ⇒ 2).",
      "darloks charge 2pw",
      "darloks build lab 7A0. tech nav. up nav (0 ⇒ 1).",
      "xenos charge 2pw",
      "xenos up int (2 ⇒ 3).",
      "darloks pass booster8 returning booster5",
      "xenos action power3.",
      "xenos spend 1q for 1o. build ac2 1A9. tech free3. up int (3 ⇒ 4).",
      "darloks charge 2pw",
      "xenos special q.",
      "xenos spend 1q for 1o. build m 7B1.",
      "darloks charge 1pw",
      "xenos spend 1pw for 1c. spend 1q for 1o. build m 6B5.",
      "xenos federation 1A8,1A9,6A4,6A8,6B2,6B4,6B5,6C,7A1,7B1 fed2 using area1: 5, area2: 1.",
      "xenos action qic1. tech adv-int. cover int. up terra (0 ⇒ 1).",
      "xenos pass booster1 returning booster3",
    ];
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const techs = possibleTechsToSpy(engine, PlayerEnum.Player2)[0] as AvailableCommand<Command.SpyTech>;
    console.log(techs.data.tiles.map((t) => t.pos));
    expect(techs.data.tiles.map((t) => t.pos)).to.not.contain(TechTilePos.Intelligence);
  });

  describe("when someone is on the top of a track", () => {
    const moves = [
      "init 2 println-hello-world",
      "p1 faction darloks",
      "p2 faction nevlas",
      "darloks build m 2A6",
      "nevlas build m 2B4",
      "nevlas build m 3B2",
      "darloks build m 3A3",
      "nevlas booster booster8",
      "darloks booster booster5",
      "darloks build ts 2A6.",
      "nevlas charge 1pw",
      "nevlas build ts 2B4.",
      "darloks charge 2pw",
      "darloks build lab 2A6. tech free1. up sci (0 ⇒ 1).",
      "nevlas charge 2pw",
      "nevlas build PI 2B4.",
      "darloks charge 2pw",
      "darloks special range+3. build m 7A2.",
      "nevlas up sci (1 ⇒ 2).",
      "darloks action power3.",
      "nevlas burn 1. action power5.",
      "darloks up sci (1 ⇒ 2).",
      "nevlas burn 1. spend 1t-a3 for 1k. up sci (2 ⇒ 3).",
      "darloks special 4pw.",
      "nevlas pass booster4 returning booster8",
      "darloks build ts 3A3.",
      "nevlas decline 1pw",
      "darloks pass booster3 returning booster5",
      "nevlas income 1t",
      "nevlas action power3.",
      "darloks special 4pw.",
      "nevlas special step. build m 3A7.",
      "darloks build m 7B4.",
      "nevlas build ts 3B2.",
      "darloks charge 2pw",
      "darloks action power7.",
      "nevlas up sci (3 ⇒ 4).",
      "darloks up sci (2 ⇒ 3).",
      "nevlas spend 2pw for 2c. spend 2pw for 2c. build ts 3A7.",
      "darloks spend 1pw for 1c. build ts 7B4.",
      "nevlas federation 2A2,2A3,2B2,2B3,2B4,3A7,3B2,3B3 fed4 using area1: 5.",
      "darloks pass booster6 returning booster3",
      "nevlas pass booster3 returning booster4",
      "nevlas income 1t",
      "darloks build lab 7B4. tech free2. up sci (3 ⇒ 4).",
      "nevlas up sci (4 ⇒ 5).",
      "darloks special 4pw.",
      "nevlas spend 2pw for 2c. pass booster8 returning booster3",
      "darloks action power7.",
    ];
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion, factionVariant: "more-balanced" });

    it("and the Darloks don't have a flippable federation, they can't join", () => {
      const p1 = engine.players[0];
      const command = possibleResearchAreas(
        engine,
        p1.player,
        UPGRADE_RESEARCH_COST
      )[0] as AvailableCommand<Command.UpgradeResearch>;
      const researchAreas = command.data.tracks;
      expect(researchAreas.map((a) => a.field)).to.not.contain(ResearchField.Science);
    });

    it("and the Darloks have a flippable federation, they can join", () => {
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move(
        "darloks federation 2A3,2A6,2B2,2B3,3A3,3A4,7A0,7A1,7A2,7A9,7B1,7B4,7C fed4 using area1: 5, area2: 4."
      );
      const p1 = newEngine.players[0];
      const command = possibleResearchAreas(
        newEngine,
        p1.player,
        UPGRADE_RESEARCH_COST
      )[0] as AvailableCommand<Command.UpgradeResearch>;
      const researchAreas = command.data.tracks;
      expect(researchAreas.map((a) => a.field)).to.contain(ResearchField.Science);
      expect(researchAreas.find((a) => a.field === ResearchField.Science).cost).to.equal("5k");
    });

    it("and the Darloks have a flippable federation, they will join", () => {
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move(
        "darloks federation 2A3,2A6,2B2,2B3,3A3,3A4,7A0,7A1,7A2,7A9,7B1,7B4,7C fed4 using area1: 5, area2: 4."
      );
      newEngine.move("darloks up sci (4 ⇒ 5).");
      const p1 = newEngine.players[0];
      expect(p1.data.research[ResearchField.Science]).to.equal(5);
      expect(p1.data.knowledge).to.equal(9);
      expect(p1.data.hasGreenFederation()).to.equal(false);
    });

    it("and the Darloks have a flippable federation but only 4k, they can't join", () => {
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move(
        "darloks federation 2A3,2A6,2B2,2B3,3A3,3A4,7A0,7A1,7A2,7A9,7B1,7B4,7C fed4 using area1: 5, area2: 4. spend 1k for 1c."
      );
      const p1 = newEngine.players[0];
      const command = possibleResearchAreas(
        newEngine,
        p1.player,
        UPGRADE_RESEARCH_COST
      )[0] as AvailableCommand<Command.UpgradeResearch>;
      const researchAreas = command.data.tracks;
      expect(researchAreas.map((a) => a.field)).to.not.contain(ResearchField.Science);
    });

    it("and the Darloks have a flippable federation, they can't get advance to the top when taking a tech tile", () => {
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move(
        "darloks federation 2A3,2A6,2B2,2B3,3A3,3A4,7A0,7A1,7A2,7A9,7B1,7B4,7C fed4 using area1: 5, area2: 4."
      );
      const p1 = newEngine.players[0];
      const command = possibleResearchAreas(
        newEngine,
        p1.player,
        "" // Free upgrade research due to a tech tile.
      )[0] as AvailableCommand<Command.UpgradeResearch>;
      const researchAreas = command.data.tracks;
      expect(researchAreas.map((a) => a.field)).to.not.contain(ResearchField.Science);
    });
  });

  describe("when advancing to the last step", () => {
    const moves = [
      "init 2 debugger",
      "p1 faction geodens",
      "p2 faction darloks",
      "geodens build m 1A5",
      "darloks build m 2A10",
      "darloks build m 7A0",
      "geodens build m 4B0",
      "darloks booster booster9",
      "geodens booster booster3",
      "geodens build m 2A9.",
      "darloks charge 1pw",
      "darloks burn 1. action power3.",
      "geodens build ts 2A9.",
      "darloks charge 1pw",
      "darloks build ts 2A10.",
      "geodens charge 2pw",
      "geodens build PI 2A9.",
      "darloks charge 2pw",
      "darloks build lab 2A10. tech nav. up nav (0 ⇒ 1).",
      "geodens charge 3pw",
      "geodens action power6. build m 1A6.",
      "darloks up terra (0 ⇒ 1).",
      "geodens up nav (0 ⇒ 1).",
      "darloks build ac1 2A10. tech free1. up nav (1 ⇒ 2).",
      "geodens charge 3pw",
      "geodens build m 7B1.",
      "darloks charge 1pw",
      "darloks pass booster5 returning booster9",
      "geodens up nav (1 ⇒ 2).",
      "geodens pass booster9 returning booster3",
      "geodens income 1t",
      "darloks special range+3. build m 7B3.",
      "geodens action power4.",
      "darloks up terra (1 ⇒ 2).",
      "geodens build ts 7B1.",
      "darloks charge 1pw",
      "darloks  spend 4pw for 4c. build ts 7B3.",
      "geodens charge 2pw",
      "geodens burn 1. action power3.",
      "darloks pass booster3 returning booster5",
      "geodens build lab 7B1. tech free3. up terra (1 ⇒ 2).",
      "darloks charge 2pw",
      "geodens  spend 1k for 1c. build m 5A9.",
      "geodens federation 1A4,1A5,1A6,2A9,5A10,5A9 fed6 using area1: 2.",
      "geodens up terra (2 ⇒ 3).",
      "geodens pass booster1 returning booster9",
      "geodens income 4pw",
      "darloks build m 4A4.",
      "geodens  spend 3pw for 3c. build m 1B1.",
      "darloks charge 3pw",
      "darloks up terra (2 ⇒ 3).",
      "geodens up terra (3 ⇒ 4).",
      "darloks action power3.",
      "geodens spend 1o for 1c. build m 1B5.",
      "darloks build m 2B0.",
      "geodens charge 4pw",
      "geodens up nav (2 ⇒ 3).",
      "darloks build m 2B3.",
      "geodens charge 2pw",
      "geodens action power5.",
      "darloks special spy-tech. spy-tech geodens free3.",
      "geodens pass booster9 returning booster1",
      "darloks federation 2A10,2A11,2B0,2B3,2C,4A4,4A5 fed5 using area1: 3.",
      "darloks pass booster1 returning booster3",
      "geodens income 4pw. income 4pw",
      "geodens action power4.",
      "darloks build lab 7B3. tech terra. up terra (3 ⇒ 4).",
      "geodens charge 2pw",
      "geodens build m 1A9.",
      "darloks charge 1pw",
    ];

    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });

    it("the research is not offered twice", () => {
      const p1 = engine.players[1];
      const command = possibleResearchAreas(
        engine,
        p1.player,
        UPGRADE_RESEARCH_COST
      )[0] as AvailableCommand<Command.UpgradeResearch>;
      const researchAreas = command.data.tracks;
      expect(researchAreas.filter((a) => a.field === ResearchField.Terraforming).length).to.equal(1);
      expect(researchAreas.find((a) => a.field === ResearchField.Terraforming).cost).to.equal(UPGRADE_RESEARCH_COST);
    });

    it("if the Darloks join someone on Terra, they gain the federation tile they chose", () => {
      const newEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      newEngine.move("darloks build m 5A2.");
      newEngine.move("geodens up terra (4 ⇒ 5).");
      newEngine.move("darloks up terra (4 ⇒ 5). fedtile fed1.");
      const p1 = newEngine.players[1];
      expect(p1.data.tiles.federations.map((fed) => fed.tile)).to.contain(Federation.Fed1);
    });
  });

  it("The Darloks can only join someone else one time", () => {
    const moves = [
      "init 2 debugger",
      "p1 faction geodens",
      "p2 faction darloks",
      "geodens build m 1A5",
      "darloks build m 2A10",
      "darloks build m 7A0",
      "geodens build m 4B0",
      "darloks booster booster9",
      "geodens booster booster3",
      "geodens build m 2A9.",
      "darloks charge 1pw",
      "darloks burn 1. action power3.",
      "geodens build ts 2A9.",
      "darloks charge 1pw",
      "darloks build ts 2A10.",
      "geodens charge 2pw",
      "geodens build PI 2A9.",
      "darloks charge 2pw",
      "darloks build lab 2A10. tech nav. up nav (0 ⇒ 1).",
      "geodens charge 3pw",
      "geodens action power6. build m 1A6.",
      "darloks up terra (0 ⇒ 1).",
      "geodens up nav (0 ⇒ 1).",
      "darloks build ac1 2A10. tech free1. up nav (1 ⇒ 2).",
      "geodens charge 3pw",
      "geodens build m 7B1.",
      "darloks charge 1pw",
      "darloks pass booster5 returning booster9",
      "geodens up nav (1 ⇒ 2).",
      "geodens pass booster9 returning booster3",
      "geodens income 1t",
      "darloks special range+3. build m 7B3.",
      "geodens action power4.",
      "darloks up terra (1 ⇒ 2).",
      "geodens build ts 7B1.",
      "darloks charge 1pw",
      "darloks  spend 4pw for 4c. build ts 7B3.",
      "geodens charge 2pw",
      "geodens burn 1. action power3.",
      "darloks pass booster3 returning booster5",
      "geodens build lab 7B1. tech free3. up terra (1 ⇒ 2).",
      "darloks charge 2pw",
      "geodens  spend 1k for 1c. build m 5A9.",
      "geodens federation 1A4,1A5,1A6,2A9,5A10,5A9 fed6 using area1: 2.",
      "geodens up terra (2 ⇒ 3).",
      "geodens pass booster1 returning booster9",
      "geodens income 4pw",
      "darloks build m 4A4.",
      "geodens  spend 3pw for 3c. build m 1B1.",
      "darloks charge 3pw",
      "darloks up terra (2 ⇒ 3).",
      "geodens up terra (3 ⇒ 4).",
      "darloks action power3.",
      "geodens spend 1o for 1c. build m 1B5.",
      "darloks build m 2B0.",
      "geodens charge 4pw",
      "geodens up nav (2 ⇒ 3).",
      "darloks build m 2B3.",
      "geodens charge 2pw",
      "geodens action power5.",
      "darloks special spy-tech. spy-tech geodens free3.",
      "geodens pass booster9 returning booster1",
      "darloks federation 2A10,2A11,2B0,2B3,2C,4A4,4A5 fed5 using area1: 3.",
      "darloks pass booster1 returning booster3",
      "geodens income 4pw. income 4pw",
      "geodens action power4.",
      "darloks build lab 7B3. tech terra. up terra (3 ⇒ 4).",
      "geodens charge 2pw",
      "geodens build m 1A9.",
      "darloks charge 1pw",
      "darloks build m 7B5.",
      "geodens charge 2pw",
      "geodens up terra (4 ⇒ 5).",
      "darloks up terra (4 ⇒ 5). fedtile fed5.",
      "geodens build ts 1B1.",
      "darloks build m 6B3.",
      "geodens spend 1q for 1o. burn 1. burn 1. spend 1pw for 1c. spend 1pw for 1c. spend 1pw for 1c. build lab 1B1. tech gaia. up gaia (0 ⇒ 1).",
      "darloks special spy-tech. spy-tech geodens gaia.",
      "geodens up nav (3 ⇒ 4).",
      "darloks spend 1pw for 1c. spend 1pw for 1c. up nav (2 ⇒ 3).",
      "geodens up nav (4 ⇒ 5). lostPlanet 1B0.",
      "darloks pass booster3 returning booster1",
      "geodens up gaia (1 ⇒ 2).",
      "geodens build gf 1A3 using area1: 6.",
      "geodens federation 1A8,1A9,1B0,1B1,1B5,7A1,7B1 fed5 using area1: 2.",
      "geodens pass booster1 returning booster9",
      "geodens income 1t",
      "darloks build ac2 7B3. tech free2. up nav (3 ⇒ 4).",
      "geodens charge 2pw",
      "geodens build m 1A3.",
    ];

    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const darloks = engine.players[1];
    const command = possibleResearchAreas(
      engine,
      darloks.player,
      UPGRADE_RESEARCH_COST
    )[0] as AvailableCommand<Command.UpgradeResearch>;
    const researchAreas = command.data.tracks;
    expect(researchAreas.map((area) => area.field)).to.not.contain(ResearchField.Navigation);
  });

  it("when Darloks are up solo, they can still join someone", () => {
    const moves = [
      "init 2 debugger",
      "p1 faction geodens",
      "p2 faction darloks",
      "geodens build m 1A5",
      "darloks build m 2A10",
      "darloks build m 7A0",
      "geodens build m 4B0",
      "darloks booster booster9",
      "geodens booster booster3",
      "geodens build m 2A9.",
      "darloks charge 1pw",
      "darloks burn 1. action power3.",
      "geodens build ts 2A9.",
      "darloks charge 1pw",
      "darloks build ts 2A10.",
      "geodens charge 2pw",
      "geodens build PI 2A9.",
      "darloks charge 2pw",
      "darloks build lab 2A10. tech nav. up nav (0 ⇒ 1).",
      "geodens charge 3pw",
      "geodens action power6. build m 1A6.",
      "darloks up terra (0 ⇒ 1).",
      "geodens up nav (0 ⇒ 1).",
      "darloks build ac1 2A10. tech free1. up nav (1 ⇒ 2).",
      "geodens charge 3pw",
      "geodens build m 7B1.",
      "darloks charge 1pw",
      "darloks pass booster5 returning booster9",
      "geodens up nav (1 ⇒ 2).",
      "geodens pass booster9 returning booster3",
      "geodens income 1t",
      "darloks special range+3. build m 7B3.",
      "geodens action power4.",
      "darloks up terra (1 ⇒ 2).",
      "geodens build ts 7B1.",
      "darloks charge 1pw",
      "darloks  spend 4pw for 4c. build ts 7B3.",
      "geodens charge 2pw",
      "geodens burn 1. action power3.",
      "darloks pass booster3 returning booster5",
      "geodens build lab 7B1. tech free3. up terra (1 ⇒ 2).",
      "darloks charge 2pw",
      "geodens  spend 1k for 1c. build m 5A9.",
      "geodens federation 1A4,1A5,1A6,2A9,5A10,5A9 fed6 using area1: 2.",
      "geodens up terra (2 ⇒ 3).",
      "geodens pass booster1 returning booster9",
      "geodens income 4pw",
      "darloks build m 4A4.",
      "geodens  spend 3pw for 3c. build m 1B1.",
      "darloks charge 3pw",
      "darloks up terra (2 ⇒ 3).",
      "geodens up terra (3 ⇒ 4).",
      "darloks action power3.",
      "geodens spend 1o for 1c. build m 1B5.",
      "darloks build m 2B0.",
      "geodens charge 4pw",
      "geodens up nav (2 ⇒ 3).",
      "darloks build m 2B3.",
      "geodens charge 2pw",
      "geodens action power5.",
      "darloks special spy-tech. spy-tech geodens free3.",
      "geodens pass booster9 returning booster1",
      "darloks federation 2A10,2A11,2B0,2B3,2C,4A4,4A5 fed5 using area1: 3.",
      "darloks pass booster1 returning booster3",
      "geodens income 4pw. income 4pw",
      "geodens action power4.",
      "darloks build lab 7B3. tech terra. up terra (3 ⇒ 4).",
      "geodens charge 2pw",
      "geodens build m 1A9.",
      "darloks charge 1pw",
      "darloks up terra (4 ⇒ 5).",
      "geodens build ts 1A9.",
      "darloks charge 1pw",
      "darloks build m 7B5.",
      "geodens charge 2pw",
      "geodens burn 1. burn 1. spend 1pw for 1c. spend 1pw for 1c. spend 1pw for 1c. spend 1q for 1o. build lab 1A9. tech gaia. up gaia (0 ⇒ 1).",
      "darloks charge 1pw",
      "darloks special spy-tech. spy-tech geodens gaia.",
      "geodens up nav (3 ⇒ 4).",
      "darloks up nav (2 ⇒ 3).",
      "geodens up gaia (1 ⇒ 2).",
      "darloks action power5.",
      "geodens build gf 1A3 using area1: 6.",
      "darloks pass booster3 returning booster1",
      "geodens up nav (4 ⇒ 5). lostPlanet 1A8.",
      "darloks charge 1pw",
      "geodens pass booster1 returning booster9",
      "geodens income 1t",
      "darloks up nav (3 ⇒ 4).",
      "geodens pass booster8 returning booster1",
      "darloks special spy-tech. spy-tech geodens free3.",
      "darloks build ac2 7B3. tech gaia. up gaia (0 ⇒ 1).",
      "geodens decline 2pw",
    ];

    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion });
    const darloks = engine.players[1];
    const command = possibleResearchAreas(
      engine,
      darloks.player,
      UPGRADE_RESEARCH_COST
    )[0] as AvailableCommand<Command.UpgradeResearch>;
    const researchAreas = command.data.tracks;
    expect(researchAreas.map((area) => area.field)).to.contain(ResearchField.Navigation);
  });
});
