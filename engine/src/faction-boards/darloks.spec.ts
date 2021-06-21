import { expect } from "chai";
import { iteratee } from "lodash";
import { PlayerEnum } from "../..";
import { generate, generate as generatePossibleMoves, possibleSpecialActions } from "../available-command";
import Engine from "../engine";
import { Command, Expansion, Resource, SubPhase, TechTilePos } from "../enums";

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
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion} );
    const specialActions = possibleSpecialActions(engine, engine.currentPlayer);
    expect(specialActions.length).to.equal(0);
  });

  it("should be able to spy on a tech tile if another player grabbed one", () => {
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
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion});
    const specialActions = possibleSpecialActions(engine, engine.currentPlayer);
    expect(specialActions.length).to.equal(1);
    const spyTech = specialActions[0].data.specialacts[0];
    expect(spyTech.income).to.equal(Resource.SpyTech);
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
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion});
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
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion});
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
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion});
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
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion});
    const p2 = engine.players[1];
    const techs = p2.data.tiles.techs;
    expect(techs.length).to.equal(1);
    expect(techs[0].pos).to.equal(TechTilePos.GaiaProject);
  });

  it("should return the tech after spying on a new one", () => {
    const moves = [
      "init 2 12",
      "p1 faction darloks",
      "p2 faction hadsch-hallas",
      "darloks build m 4A10",
      "hadsch-hallas build m 4B5",
      "hadsch-hallas build m 5A5",
      "darloks build m 2A6",
      "hadsch-hallas booster booster2",
      "darloks booster booster1",
      "hadsch-hallas income 2t",
      "darloks build ts 4A10.",
      "hadsch-hallas charge 1pw",
      "hadsch-hallas build ts 4B5.",
      "darloks charge 2pw",
      "darloks build lab 4A10. tech sci. up sci.",
      "hadsch-hallas charge 2pw",
      "hadsch-hallas build lab 4B5. tech eco. up eco.",
      "darloks charge 2pw",
      "darloks special spy-tech. spy-tech hadsch-hallas eco.",
      "hadsch-hallas up terra.",
      "darloks special 4pw.",
      "hadsch-hallas pass booster9 returning booster2",
      "darloks pass booster8 returning booster1",
      "hadsch-hallas build ac1 4B5. tech terra. up terra.",
      "darloks action power3.",
      "hadsch-hallas action qic3.",
      "darloks special 4pw.",
      "hadsch-hallas pass booster1 returning booster9",
      "darloks special spy-tech. spy-tech hadsch-hallas terra.",
    ];
    const engine = new Engine(moves, { expansion: Expansion.MasterOfOrion});
    const p1 = engine.players[0];
    const techs = p1.data.tiles.techs;
    const spiedTechs = techs.filter((t) => !!t.owner);
    expect(spiedTechs.length).to.equal(1);
    expect(spiedTechs[0].pos).to.equal("terra");
  });
});
