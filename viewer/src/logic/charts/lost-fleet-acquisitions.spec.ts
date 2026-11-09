import Engine, {
  ArtifactToken,
  Expansion,
  Faction,
  PlayerEnum,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  TechTile,
} from "@gaia-project/engine";
import { TinkeringTile } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { ChartSetup } from "./chart-factory";
import { federationsSourceFactory } from "./federations";
import { lostFleetSourceFactories } from "./lost-fleet";
import { tableItems } from "./table";
import { baseTechSourceFactory } from "./tech";

const style = { type: "table" as const, label: "Table", compact: false };
function fixture() {
  const engine = new Engine(["init 3 lost-fleet-acquisitions"], { lostFleet: true });
  engine.players.forEach((p, i) => {
    p.faction = [Faction.Moweyds, Faction.Tinkeroids, Faction.Terrans][i];
    p.loadFaction(null, engine.expansions);
  });
  engine.moveHistory = [];
  engine.advancedLog = [];
  return engine;
}
function record(engine: Engine, player: PlayerEnum, round: number, commands: string) {
  engine.advancedLog.push({ round, player, move: engine.moveHistory.length });
  engine.advancedLog.sort((a, b) => a.round - b.round);
  engine.round = Math.max(engine.round, round);
  engine.moveHistory.push(`${engine.player(player).faction} ${commands}`);
}

function check(engine: Engine, category: string, expected: number[], player = PlayerEnum.Player1) {
  const setup = new ChartSetup(engine);
  const factory = setup.factory(category, null);
  for (let repeat = 0; repeat < 2; repeat++) {
    const bar = setup.newBarChart(style, factory, engine, (c) => c);
    const dataset = bar.chart.data.datasets[player];
    expect(dataset.data).to.deep.equal(expected);
    expect(bar.table.datasetMeta[dataset.label].total).to.equal(expected.reduce((a, b) => a + b, 0));
    expect(tableItems(bar.chart, bar.table)).to.have.length.greaterThan(0);
    const line = setup.newLineChart(style, factory, engine, player, (c) => c);
    expected.forEach((count, i) => expect(line.data.datasets[i].data[6]).to.deep.equal({ x: 6, y: count }));
  }
}

describe("Lost Fleet acquisition and exploration statistics", () => {
  it("adds no Lost Fleet rows/categories to base games", () => {
    expect(lostFleetSourceFactories(Expansion.None)).to.deep.equal([]);
    expect(baseTechSourceFactory(Expansion.None).sources.map((s) => s.type)).to.deep.equal(
      TechTile.values(Expansion.None)
    );
    expect(federationsSourceFactory(Expansion.LostFleet).sources.length).to.equal(
      federationsSourceFactory(Expansion.None).sources.length + 8
    );
  });

  it("counts all three ship techs after supplies disappear, including covered tiles, without recounting cover/research commands", () => {
    const engine = fixture();
    const ships = [Spaceship.Rebellion, Spaceship.TFMars, Spaceship.Eclipse];
    const tiles = SpaceshipTechTile.values(engine.expansions);
    tiles.forEach((tile, i) => {
      const pos = ships[i];
      engine.players[0].data.tiles.techs.push({ tile, pos, enabled: false });
      delete engine.tiles.spaceshipTechs[pos];
      record(engine, PlayerEnum.Player1, i + 1, `tech ${pos}. cover ${pos}. up nav. endturn`);
      record(engine, PlayerEnum.Player2, i + 1, `tech ${pos}. up nav. endturn`);
    });
    const expected = baseTechSourceFactory(engine.expansions).sources.map((s) =>
      tiles.includes(s.type as SpaceshipTechTile) ? 1 : 0
    );
    check(engine, "Base Tech Tiles", expected);
    check(engine, "Base Tech Tiles", expected, PlayerEnum.Player2);
    check(
      engine,
      "Base Tech Tiles",
      expected.map(() => 0),
      PlayerEnum.Player3
    );
    // Supply-present lookup also works before any stored player tile exists.
    engine.players[0].data.tiles.techs = [];
    tiles.forEach((tile, i) => (engine.tiles.spaceshipTechs[ships[i]] = { tile, count: 2 }));
    check(engine, "Base Tech Tiles", expected);
  });

  it("counts all eight spaceship federation acquisitions but not any re-scoring or follow-up rewards", () => {
    const engine = fixture();
    const tokens = SpaceshipFederation.values(engine.expansions);
    tokens.forEach((token, i) => {
      record(engine, PlayerEnum.Player1, Math.floor(i / 3) + 1, `federation 0x0 ${token}. tech free1. up nav. endturn`);
      record(
        engine,
        PlayerEnum.Player2,
        Math.floor(i / 3) + 1,
        `spaceshipAction twilight qic. fedtile ${token}. endturn`
      );
    });
    const expected = federationsSourceFactory(engine.expansions).sources.map((s) =>
      tokens.includes(s.type as SpaceshipFederation) ? 1 : 0
    );
    check(engine, "Federations", expected);
    check(
      engine,
      "Federations",
      expected.map(() => 0),
      PlayerEnum.Player2
    );
  });

  it("counts explore commands by ship across rounds, not Moweyds' automatic starting access or ship actions", () => {
    const engine = fixture();
    engine.players[0].data.explorationShips[Spaceship.TFMars] = 1;
    check(engine, "Exploration", [0, 0, 0, 0]);
    Spaceship.values(engine.expansions).forEach((ship, i) => {
      record(engine, PlayerEnum.Player1, i + 1, `explore ${ship}. endturn`);
      record(engine, PlayerEnum.Player2, i + 1, `spaceshipAction ${ship} qic. endturn`);
    });
    check(engine, "Exploration", [1, 1, 1, 1]);
    check(engine, "Exploration", [0, 0, 0, 0], PlayerEnum.Player2);
    const setup = new ChartSetup(engine);
    const line = setup.newLineChart(style, setup.factory("Exploration", null), engine, PlayerEnum.Player1, (c) => c);
    line.data.datasets.forEach((dataset, shipIndex) => {
      for (let round = 1; round <= 4; round++) {
        expect(dataset.data[round]).to.deep.equal({ x: round, y: round > shipIndex ? 1 : 0 });
      }
    });
  });

  it("counts artifact choices once per token, separately from examinations, tinkering selections and power ring placement", () => {
    const engine = fixture();
    ArtifactToken.values(engine.expansions).forEach((token, i) => {
      record(
        engine,
        PlayerEnum.Player1,
        Math.floor(i / 3) + 1,
        `examineArtifact. chooseArtifactToken ${token}. fedtile fed2. endturn`
      );
    });
    TinkeringTile.values().forEach((tile, i) =>
      record(engine, PlayerEnum.Player2, i + 1, `chooseTinkeringTile ${tile}. special 1q. endturn`)
    );
    record(engine, PlayerEnum.Player2, 2, "placePowerRing 0x0. placePowerRing 1x0. endturn");
    check(
      engine,
      "Artifacts",
      ArtifactToken.values(engine.expansions).map(() => 1)
    );
    check(
      engine,
      "Artifacts",
      ArtifactToken.values(engine.expansions).map(() => 0),
      PlayerEnum.Player2
    );
    check(engine, "Lost Fleet activities", [13, 0, 0]);
    check(engine, "Lost Fleet activities", [0, 6, 2], PlayerEnum.Player2);
  });
});
