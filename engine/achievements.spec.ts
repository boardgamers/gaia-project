import { expect } from "chai";
import Beta2 from "./fixtures/Beta-2.json";
import { automaDifficulties } from "./src/automa";
import Engine from "./src/engine";
import { Building, Expansion, Faction, Phase, Planet, ResearchField, Round } from "./src/enums";
import { achievementDefinitions, achievements, factions, rankings, scores } from "./wrapper";

// Existing completed-game fixture for integration; mutations below are predicate boundary tests,
// not claims that the difficult feats have been demonstrated in a six-round resource budget.
function state(): Record<string, any> {
  return JSON.parse(JSON.stringify(Beta2));
}

function earned(data: Record<string, any>, seat = 0): string[] {
  return achievements(data).find((result) => result.seat === seat).earned;
}

const baseTypes = [
  Planet.Terra,
  Planet.Desert,
  Planet.Swamp,
  Planet.Oxide,
  Planet.Volcanic,
  Planet.Titanium,
  Planet.Ice,
  Planet.Gaia,
  Planet.Lost,
];

function colonies(data: Record<string, any>, types: Planet[]) {
  for (const hex of data.map) {
    delete hex.data.player;
    delete hex.data.building;
    delete hex.data.additionalMine;
  }
  types.forEach((planet, index) => {
    Object.assign(data.map[index].data, { planet, player: 0, building: Building.Mine });
  });
}

function solo(difficulty = "automa"): Record<string, any> {
  const data = state();
  data.players = data.players.slice(0, 2);
  data.players[1].isAutoma = true;
  data.automa = { difficulty, round: 6, remaining: 0, discard: [], boosters: [], lastActions: [] };
  // Keep a valid map after removing the other two fixture seats.
  for (const hex of data.map) {
    if (hex.data.player > 1) {
      delete hex.data.player;
      delete hex.data.building;
    }
  }
  return data;
}

describe("BGS achievement hooks", () => {
  it("exports a complete, unique, isolated revision-2 catalog", () => {
    const manifest = achievementDefinitions();
    const ids = manifest.achievements.map((definition) => definition.id);
    expect(manifest.revision).to.equal(2);
    expect(ids).to.have.length(36);
    expect(new Set(ids).size).to.equal(ids.length);
    // BGS packages/protocol/achievements.ts: achievementIdSchema.
    for (const id of ids) expect(id).to.match(/^[a-z0-9][a-z0-9-]{0,63}$/);
    for (const faction of Faction.values(Expansion.All)) expect(ids).to.include(`win-faction-${faction}`);
    for (const difficulty of automaDifficulties) expect(ids).to.include(`win-automa-${difficulty}`);
    expect(manifest.achievements.every((definition) => definition.name && definition.description)).to.equal(true);
    manifest.achievements[0].name = "mutated";
    expect(achievementDefinitions().achievements[0].name).not.to.equal("mutated");
  });

  it("adds only 18 named faction assets and four score text emblems without changing IDs", () => {
    const definitions = achievementDefinitions().achievements;
    const assets = definitions.filter((definition) => definition.icon?.type === "asset");
    const texts = definitions.filter((definition) => definition.icon?.type === "text");
    expect(assets).to.have.length(18);
    expect(texts).to.have.length(4);
    for (const faction of Faction.values(Expansion.All)) {
      expect(definitions.find((definition) => definition.id === `win-faction-${faction}`).icon).to.deep.equal({
        type: "asset",
        key: `achievement-faction-${faction}`,
      });
    }
    for (const mode of ["base", "lost-fleet"]) {
      for (const score of [150, 200]) {
        expect(definitions.find((definition) => definition.id === `score-${mode}-${score}`).icon).to.deep.equal({
          type: "text",
          text: String(score),
        });
      }
    }
    for (const definition of definitions) {
      const icon = definition.icon;
      if (icon?.type === "asset") {
        expect(Object.keys(icon).sort()).to.deep.equal(["key", "type"]);
        expect(icon.key).to.match(/^[a-z0-9][a-z0-9-]{0,63}$/);
      } else if (icon?.type === "text") {
        expect(Object.keys(icon).sort()).to.deep.equal(["text", "type"]);
        expect(icon.text).to.match(/^[A-Za-z0-9]{1,4}$/);
      } else {
        expect(definition).not.to.have.property("icon");
        expect(definition.id.startsWith("win-faction-") || definition.id.startsWith("score-")).to.equal(false);
      }
    }
    const first = assets[0];
    if (first.icon.type === "asset") first.icon.key = "mutated";
    expect(
      achievementDefinitions().achievements.find((definition) => definition.id === first.id).icon
    ).not.to.deep.equal(first.icon);
  });

  it("hydrates the existing completed fixture, agrees with wrapper outcomes, and is deterministic", () => {
    const data = state();
    const engine = Engine.fromData(state());
    const result = achievements(data);
    expect(result.map((entry) => entry.seat)).to.deep.equal([0, 1, 2, 3]);
    expect(scores(engine)).to.deep.equal([151, 135, 213, 138]);
    expect(factions(engine)[2]).to.equal(Faction.HadschHallas);
    expect(result[2].outcome).to.equal("win");
    expect(result[2].earned).to.include.members([
      "win-faction-hadsch-hallas",
      "win-mode-base",
      "score-base-150",
      "score-base-200",
    ]);
    expect(result[0].outcome).to.equal("loss");
    expect(result[0].earned).to.include("score-base-150");
    expect(result[0].earned.some((id) => id.startsWith("win-"))).to.equal(false);
    expect(achievements(engine)).to.deep.equal(result);
    expect(achievements(data)).to.deep.equal(result);
    const ids = new Set(achievementDefinitions().achievements.map((definition) => definition.id));
    expect(result.every((entry) => entry.earned.every((id) => ids.has(id)))).to.equal(true);
  });

  it("does not mutate serialized legacy options or federation caches during hydration", () => {
    const data = state();
    const engine = Engine.fromData(state());
    data.players[0].federationCache = {
      federations: [{ hexes: [engine.players[0].data.occupied[0].toString()] }],
    };
    const before = JSON.stringify(data);
    achievements(data);
    expect(JSON.stringify(data)).to.equal(before);
    achievements(data);
    expect(JSON.stringify(data)).to.equal(before);
  });

  it("awards nothing before authoritative final scoring or after early cancellation", () => {
    for (const phase of [Phase.RoundMove, Phase.RoundGaia]) {
      const data = state();
      data.phase = phase;
      expect(achievements(data)).to.deep.equal([]);
    }
    const cancelled = state();
    cancelled.round = 0;
    expect(achievements(cancelled)).to.deep.equal([]);
    const stopped = state();
    stopped.advancedLog = stopped.advancedLog.filter((entry) => entry.phase !== Phase.EndGame);
    expect(achievements(stopped)).to.deep.equal([]);
  });

  it("retains human-seat indexing without awarding dropped players", () => {
    const data = state();
    data.players[0].dropped = true;
    const result = achievements(data);
    expect(result[0]).to.deep.equal({ seat: 0, earned: [] });
    expect(result[2].seat).to.equal(2);
    expect(result[2].earned).to.include("win-faction-hadsch-hallas");
  });

  it("treats multiplayer tied first place as wins, not draws", () => {
    const data = state();
    data.players[0].data.victoryPoints = 213;
    expect(achievements(data).map((entry) => entry.outcome)).to.deep.equal(["win", "loss", "win", "loss"]);
  });

  it("uses exact resolved Automa difficulty and excludes the bot seat, including ties and losses", () => {
    for (const difficulty of automaDifficulties) {
      const data = solo(difficulty);
      data.players[0].data.victoryPoints = 200;
      for (const botScore of [199, 200, 201]) {
        data.players[1].data.victoryPoints = botScore;
        const result = achievements(data);
        expect(result).to.have.length(1);
        expect(result[0].seat).to.equal(0);
        const won = rankings(Engine.fromData(data))[0] === 1;
        expect(result[0].outcome).to.equal(won ? "win" : "loss");
        expect(result[0].earned.filter((id) => id.startsWith("win-automa-"))).to.deep.equal(
          won ? [`win-automa-${difficulty}`] : []
        );
        expect(result[0].earned).to.include("score-base-200");
      }
    }
  });

  it("separates rulesets, not faction origin, and checks final-score thresholds inclusively", () => {
    for (const lostFleet of [false, true]) {
      const data = state();
      data.options.lostFleet = lostFleet;
      const mode = lostFleet ? "lost-fleet" : "base";
      for (const score of [149, 150, 199, 200]) {
        data.players[0].data.victoryPoints = score;
        const ids = earned(data);
        expect(ids.includes(`score-${mode}-150`)).to.equal(score >= 150);
        expect(ids.includes(`score-${mode}-200`)).to.equal(score >= 200);
        expect(ids.some((id) => id.startsWith(`score-${lostFleet ? "base" : "lost-fleet"}-`))).to.equal(false);
      }
      expect(earned(data, 2)).to.include(`win-mode-${mode}`);
    }
  });

  it("supports every faction win, including the four expansion factions", () => {
    for (const faction of Faction.values(Expansion.All)) {
      const data = state();
      data.options.lostFleet = true;
      data.players[2].faction = faction;
      delete data.players[2].variant;
      expect(earned(data, 2)).to.include(`win-faction-${faction}`);
    }
  });

  it("requires every standard piece currently deployed, not virtual or returned mines", () => {
    const data = state();
    const buildings = {
      [Building.Mine]: 8,
      [Building.TradingStation]: 4,
      [Building.ResearchLab]: 3,
      [Building.PlanetaryInstitute]: 1,
      [Building.Academy1]: 1,
      [Building.Academy2]: 1,
    };
    Object.assign(data.players[0].data.buildings, buildings);
    expect(earned(data)).to.include("build-all-standard");
    for (const building of Object.keys(buildings)) {
      data.players[0].data.buildings[building]--;
      data.players[0].data.lostPlanet = 1;
      data.players[0].data.artifactPlanetTypes = [Planet.Asteroid, Planet.Protoplanet];
      expect(earned(data)).not.to.include("build-all-standard");
      data.players[0].data.buildings[building]++;
    }
  });

  it("counts formations, not token inventory, and applies Ivits' growing-federation feat only to Ivits", () => {
    const data = state();
    data.players[0].data.federationCount = 2;
    data.players[0].data.tiles.federations = Array(5).fill({ tile: "fed1", green: true });
    data.players[0].data.spaceshipFederations = [{ tile: "unused", green: true }];
    expect(earned(data)).not.to.include("federation-form-3");
    data.players[0].data.federationCount = 3;
    data.players[0].data.tiles.federations = [];
    data.players[0].data.spaceshipFederations = [];
    expect(earned(data)).to.include("federation-form-3");
    expect(earned(data)).not.to.include("faction-ivits-growing-federation");
    data.players[0].faction = Faction.Ivits;
    delete data.players[0].variant;
    expect(earned(data)).to.include("faction-ivits-growing-federation");
  });

  it("requires all nine physical base types including Lost, but never Transdim", () => {
    const data = state();
    colonies(data, baseTypes);
    expect(earned(data)).to.include("explore-all-types-base");
    for (let index = 0; index < baseTypes.length; index++) {
      const hex = data.map[index];
      hex.data.planet = Planet.Transdim;
      expect(earned(data)).not.to.include("explore-all-types-base");
      hex.data.planet = baseTypes[index];
    }
    data.map[7].data.building = Building.GaiaFormer;
    expect(earned(data)).not.to.include("explore-all-types-base");
  });

  it("requires physical asteroid and protoplanet colonies in Lost Fleet, not artifact types", () => {
    const data = state();
    data.options.lostFleet = true;
    colonies(data, baseTypes);
    data.players[0].data.artifactPlanetTypes = [Planet.Asteroid, Planet.Protoplanet];
    expect(earned(data)).not.to.include("explore-all-types-lost-fleet");
    colonies(data, [...baseTypes, Planet.Asteroid, Planet.Protoplanet]);
    expect(earned(data)).to.include("explore-all-types-lost-fleet");
    expect(earned(data)).not.to.include("explore-all-types-base");
  });

  it("counts Lantids shared mines separately from main-owned planet types", () => {
    const data = state();
    data.players[0].faction = Faction.Lantids;
    delete data.players[0].variant;
    colonies(data, baseTypes);
    for (let index = 0; index < 6; index++) {
      Object.assign(data.map[index].data, { player: 1, additionalMine: 0 });
    }
    expect(earned(data)).to.include("faction-lantids-shared-civilization");
    expect(earned(data)).not.to.include("explore-all-types-base");
    delete data.map[5].data.additionalMine;
    expect(earned(data)).not.to.include("faction-lantids-shared-civilization");
  });

  it("requires Bescods and all six research tracks at level three or above", () => {
    const data = state();
    for (const field of ResearchField.values(Expansion.All)) data.players[0].data.research[field] = 3;
    expect(earned(data)).not.to.include("faction-bescods-balanced-research");
    data.players[0].faction = Faction.Bescods;
    delete data.players[0].variant;
    expect(earned(data)).to.include("faction-bescods-balanced-research");
    for (const field of ResearchField.values(Expansion.All)) {
      data.players[0].data.research[field] = 2;
      expect(earned(data)).not.to.include("faction-bescods-balanced-research");
      data.players[0].data.research[field] = 4;
    }
  });

  it("can evaluate the fixture replay after the actual final-scoring transition", () => {
    const engine = Engine.fromData(state()).replayedTo();
    expect(engine.phase).to.equal(Phase.EndGame);
    expect(engine.round).to.equal(Round.LastRound);
    expect(achievements(engine)).to.deep.equal(achievements(JSON.parse(JSON.stringify(engine))));
    expect(achievements(engine).filter((result) => result.outcome === "win")).to.have.length.greaterThan(0);
  });
});
