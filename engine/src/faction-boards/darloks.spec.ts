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
});
