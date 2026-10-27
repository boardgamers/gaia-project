import { expect } from "chai";
import * as wrapper from "../../wrapper";
import Engine from "../engine";
import { Building, Command, Faction, FinalTile, Phase, ResearchField, Spaceship } from "../enums";
import { automaFactions, nextAutomaMove, playAutomaTurn, startAutomaRound } from "./index";

function ready(faction = Faction.Taklons, lostFleet = false, difficulty: any = "automa") {
  const engine = new Engine(["init 1 solo-regression"], {
    lostFleet,
    automaFaction: faction,
    automaSeed: "private-regression-seed",
    automaDifficulty: difficulty,
  });
  const human = faction === Faction.HadschHallas ? Faction.Terrans : Faction.HadschHallas;
  engine.move(`p1 faction ${human}`);
  wrapper.automove(engine);
  engine.players[0].settings.autoIncome = true;
  while (!engine.round) {
    engine.generateAvailableCommands();
    const cmd = engine.availableCommands[0];
    if (cmd.name === Command.Build) {
      const build = cmd.data.buildings[0];
      engine.move(`p1 build ${build.building} ${build.coordinates}`);
    } else if (cmd.name === Command.ChooseRoundBooster) {
      engine.move(`p1 booster ${cmd.data.boosters[0]}`);
    } else throw new Error(`Unexpected setup ${cmd.name}`);
    wrapper.automove(engine);
  }
  return engine;
}

function forceDraw(engine: Engine, support: string, action: string) {
  engine.currentPlayer = 1;
  engine.tempCurrentPlayer = undefined;
  engine.phase = Phase.RoundMove;
  engine.automa.action = undefined;
  engine.automa.support = undefined;
  engine.automa.deck = [support, action, "6", "8", "10", "11"];
  engine.automa.remaining = 6;
  engine.move(`p2 automa ${support},${action}`);
}

describe("Official solo Automa", () => {
  it("keeps one platform seat, the shuffle private, and public replay usable", async () => {
    const engine = await wrapper.init(1, ["lost-fleet"], {}, "public-seed");
    expect(engine.players.map((p) => p.isAutoma)).to.deep.equal([false, true]);
    expect(wrapper.scores(engine)).to.have.length(1);
    expect(wrapper.factions(engine)).to.have.length(1);
    expect(wrapper.timeIncrements(engine)).to.have.length(1);
    expect(engine.options.automaSeed).to.be.a("string");
    expect(wrapper.stripSecret(engine).options).not.to.have.property("automaSeed");
    expect(() => wrapper.move(engine, "p2 faction taklons", 0)).to.throw();
    const game = ready(Faction.Taklons, true);
    expect(game.automa.deck).to.have.length(7);
    const view = wrapper.stripSecret(game, 0);
    expect(view.automa).not.to.have.property("deck");
    expect(wrapper.analysisView(game, { player: 0 }).state.options).not.to.have.property("automaSeed");
    expect(
      wrapper.createAnalysis(game, { to: game.moveHistory.length, sourceEnded: false }).options
    ).not.to.have.property("automaSeed");
    const publicGame = Engine.fromData(view);
    publicGame.currentPlayer = 1;
    expect(nextAutomaMove(publicGame)).to.equal(undefined);
    expect(game.automa.deck).to.have.length(7);
  });

  it("uses the solo ships and no artifacts, without giving the Automa human resources", () => {
    const engine = ready(Faction.Terrans, true);
    const bot = engine.players[1];
    const ships = [...engine.map.grid.values()].filter((h) => h.hasSpaceship()).map((h) => h.data.spaceship);
    expect(ships).to.have.members([Spaceship.Rebellion, Spaceship.Eclipse, Spaceship.TFMars]);
    expect(engine.tiles.artifacts).to.have.length(0);
    expect(Object.keys(engine.tiles.spaceshipTechs)).to.have.members(ships);
    expect(bot.data.research.gaia).to.equal(1);
    expect(bot.data.victoryPoints).to.equal(15);
    expect(bot.ownedPlanets).to.have.length(2);
    expect(Object.keys(bot.data.explorationShips)).to.have.length(1);
    expect([
      bot.data.credits,
      bot.data.ores,
      bot.data.knowledge,
      bot.data.qics,
      bot.data.power.area1,
      bot.data.power.area2,
      bot.data.power.area3,
    ]).to.deep.equal([0, 0, 0, 0, 0, 0, 0]);
    expect(Object.values(bot.events).every((events) => events.length === 0)).to.equal(true);
  });

  it("honours difficulty deck changes and adds exactly one reserve card per round", () => {
    for (const [difficulty, size, vp] of [
      ["automalein", 6, 0],
      ["automa", 7, 15],
      ["automaechtig", 8, 20],
      ["ultoma", 9, 25],
      ["alptrauma", 9, 10],
    ] as const) {
      const engine = ready(Faction.Taklons, true, difficulty);
      expect(engine.automa.deck).to.have.length(size);
      expect(engine.players[1].data.victoryPoints).to.equal(vp);
      const first = engine.automa.deck.slice();
      engine.round = 2;
      startAutomaRound(engine);
      expect(engine.automa.deck).to.have.length(size + 1);
      expect(first.every((c) => engine.automa.deck.includes(c))).to.equal(true);
      if (difficulty === "automalein") expect(engine.automa.deck).not.to.include("2");
      if (["automaechtig", "ultoma", "alptrauma"].includes(difficulty)) expect(first).to.include("9");
      if (["ultoma", "alptrauma"].includes(difficulty)) expect(first).to.include("15");
    }
  });

  it("upgrades without paying or gaining normal income/tech rewards", () => {
    const engine = ready(Faction.HadschHallas);
    const bot = engine.players[1];
    forceDraw(engine, "4", "1");
    expect(bot.data.buildings[Building.TradingStation]).to.equal(1);
    expect(bot.data.victoryPoints).to.equal(14); // card 1 + Hadsch Hallas 3
    expect(bot.data.tiles.techs).to.have.length(0);
    expect(bot.data.credits).to.equal(0);
    expect(bot.events["+"]).to.have.length(0);
    expect(bot.finalCount(FinalTile.StructureFed)).to.equal(bot.ownedPlanets.length - 1);
    expect(bot.progress(FinalTile.StructureFed)).to.equal(bot.finalCount(FinalTile.StructureFed));
  });

  it("takes an advanced tech before level 5, blocks its track, and takes no top-track reward", () => {
    const engine = ready();
    const bot = engine.players[1];
    bot.data.research[ResearchField.Navigation] = 4;
    forceDraw(engine, "4", "3");
    expect(engine.tiles.techs["adv-nav"].count).to.equal(0);
    expect(bot.data.research.nav).to.equal(4);
    forceDraw(engine, "4", "3");
    expect(bot.data.research.nav).to.equal(5);
    expect(bot.data.lostPlanet).to.equal(0);
    expect(bot.data.qics).to.equal(0);
  });

  it("blocks a Lost Fleet action and its left neighbour using the shared availability state", () => {
    const engine = ready(Faction.Itars, true);
    engine.players[1].data.explorationShips = {
      [Spaceship.Rebellion]: 0,
      [Spaceship.Eclipse]: 0,
      [Spaceship.TFMars]: 0,
    };
    // Card 2 counts two from the left, but every power space is already blocked.
    for (const action of engine.boardActionTypes) engine.boardActions[action] = 0;
    forceDraw(engine, "2", "5");
    expect(engine.spaceshipActions[Spaceship.Rebellion]?.qic).to.equal(1);
    expect(engine.spaceshipActions[Spaceship.Rebellion]?.power).to.equal(1);
  });

  it("passes on a pass card only among the last three cards", () => {
    const engine = ready();
    forceDraw(engine, "4", "1");
    expect(engine.passedPlayers).not.to.include(1);
    engine.automa.deck = ["2", "6", "8"];
    engine.automa.remaining = 3;
    const previous = engine.players[1].data.tiles.booster;
    const next = engine.automa.boosters[0]; // support becomes card 1: left booster
    expect(playAutomaTurn(engine, "p2 automa 2")).to.equal(true);
    expect(engine.players[1].data.tiles.booster).to.equal(next);
    expect(engine.automa.boosters.slice(-1)).to.deep.equal([previous]);
  });

  for (const lostFleet of [false, true])
    for (const faction of automaFactions) {
      it(`finishes and replays ${faction}, ${lostFleet ? "Lost Fleet" : "base game"}, including a save after every decision`, () => {
        let engine = ready(faction, lostFleet);
        for (let decisions = 0; !engine.ended && decisions < 200; decisions++) {
          expect(wrapper.currentPlayer(engine)).to.equal(0);
          engine.generateAvailableCommands();
          const pass = engine.availableCommands.find((c) => c.name === Command.Pass);
          const move = pass ? `p1 pass ${pass.data.boosters[0] ?? ""}` : "p1 decline";
          engine = wrapper.move(engine, move, 0);
          engine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
        }
        expect(engine.ended).to.equal(true);
        expect(engine.round).to.equal(6);
        const summarize = (e: Engine) => ({
          scores: e.players.map((p) => p.data.victoryPoints),
          planets: JSON.parse(JSON.stringify(e.map.toJSON())),
          research: e.players.map((p) => p.data.research),
          booster: e.automa.boosters,
        });
        expect(summarize(engine.replayedTo())).to.deep.equal(summarize(engine));
        expect(summarize(Engine.fromData(wrapper.stripSecret(engine, 0)).replayedTo())).to.deep.equal(
          summarize(engine)
        );
        expect(engine.automa.discard.length).to.be.lessThan(17);
        expect(wrapper.scores(engine)).to.deep.equal([engine.players[0].data.victoryPoints]);
      });
    }
});
