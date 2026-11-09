import Engine, {
  ArtifactToken,
  BoardAction,
  Building,
  Command,
  Expansion,
  Faction,
  Federation,
  Phase,
  Planet,
  PlayerEnum,
  Resource,
  Spaceship,
  SpaceshipTechTile,
} from "@gaia-project/engine";
import { Power } from "@gaia-project/engine/src/player-data";
import { spaceshipBoards } from "@gaia-project/engine/src/spaceships";
import { expect } from "chai";
import { spaceshipNames } from "../../data/spaceships";
import { parseCommands } from "../recent";
import { balanceSheetResourceName, balanceSheetResources } from "./balance-sheet";
import { ChartSetup } from "./chart-factory";
import { ChartGroup } from "./charts";
import { newResourceSimulator } from "./resource-counter";
import { boardActionSourceFactory } from "./resources";

function fixture() {
  const engine = new Engine(["init 3 lost-fleet-chart-actions"], { lostFleet: true });
  engine.players.forEach((player, i) => {
    player.faction = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas][i];
    player.loadFaction(null, engine.expansions);
    player.data.qics = 10;
    player.data.credits = 20;
    player.data.knowledge = 10;
    player.data.ores = 10;
    player.data.power = new Power(0, 8, 4, 0);
    for (const ship of Spaceship.values(engine.expansions)) {
      player.data.explorationShips[ship] = 1;
    }
    player.data.tiles.federations.push({ tile: Federation.Fed2, green: false });
  });
  engine.phase = Phase.RoundMove;
  engine.round = 1;
  engine.turnOrder = engine.players.map((p) => p.player);
  engine.currentPlayer = PlayerEnum.Player1;
  // Record the injected starting resources as setup income, so balance-sheet
  // simulation has the same budget as this small round-move fixture.
  engine.advancedLog = engine.players.map((p) => ({
    player: p.player,
    changes: {
      [Phase.BeginGame]: {
        [Resource.GainToken]: 12,
        [Resource.ChargePower]: 16,
        [Resource.Credit]: 20,
        [Resource.Ore]: 10,
        [Resource.Knowledge]: 10,
        [Resource.Qic]: 10,
      },
    },
  }));
  engine.addAdvancedLog({ round: 1 });
  return engine;
}

const style = { type: "table" as const, label: "Table", compact: false };

describe("Lost Fleet board-action statistics", () => {
  it("keeps base-game rows unchanged and gives all twelve ship actions distinct names and keys", () => {
    const base = boardActionSourceFactory(Expansion.None);
    const expanded = boardActionSourceFactory(Expansion.LostFleet);
    expect(base.sources.map((s) => s.type)).to.deep.equal(BoardAction.values());
    expect(expanded.sources.slice(0, base.sources.length)).to.deep.equal(base.sources);
    expect(expanded.sources).to.have.length(base.sources.length + 12);
    expect(new Set(expanded.sources.map((s) => s.type)).size).to.equal(expanded.sources.length);
    expect(new Set(expanded.sources.map((s) => s.label)).size).to.equal(expanded.sources.length);
  });

  it("matches both ship and action and ignores costs, rewards, other players and exploration", () => {
    const engine = fixture();
    const factory = boardActionSourceFactory(engine.expansions);
    for (const ship of Spaceship.values(engine.expansions)) {
      for (const action of spaceshipBoards[ship].actions) {
        const commands = parseCommands(
          `terrans burn 1. spend 1o for 1c. spaceshipAction ${ship} ${action.type}. tech free1. up nav. fedtile fed2. explore eclipse. endturn`
        );
        const counts = factory.sources.map((source) => {
          const process = factory.extractLog.processor(engine.players[0], source, engine);
          const count = (cmd, cmdIndex) =>
            process({ cmd, cmdIndex, allCommands: commands, source, data: engine, log: {} });
          expect(count({ ...commands[2], faction: Faction.Lantids }, 2)).to.equal(0);
          return commands.reduce((n, cmd, i) => n + count(cmd, i), 0);
        });
        expect(counts.reduce((a, b) => a + b, 0)).to.equal(1);
        const source = factory.sources[counts.indexOf(1)];
        expect(source.type).to.equal(`spaceshipAction:${ship}:${action.type}`);
        expect(source.label).to.contain(spaceshipNames[ship]);
      }
    }
  });

  it("consumes ship power costs at the action, before subsequent free conversions", () => {
    const engine = fixture();
    engine.move("terrans spaceshipAction eclipse power. up nav. spend 1pw for 1c. endturn");
    const log = engine.advancedLog.find((entry) => entry.changes?.[Spaceship.Eclipse]);
    const commands = parseCommands(engine.moveHistory[log.move]);
    const simulator = newResourceSimulator(engine.players[0], engine.expansions);
    const changes = commands.map((cmd, cmdIndex) =>
      simulator.simulateResources({
        cmd,
        cmdIndex,
        allCommands: commands,
        log,
        data: engine,
        source: null,
      })
    );
    expect(changes[0][Spaceship.Eclipse].some((r) => r.type === Resource.ChargePower && r.count === -3)).to.equal(true);
    expect(changes[2][Spaceship.Eclipse]).to.equal(undefined);
    expect(changes[2][Command.Spend].some((r) => r.type === Resource.ChargePower && r.count === -1)).to.equal(true);
  });

  for (const artifact of [false, true]) {
    it(`includes ${artifact ? "artifact" : "exploration"} resources without counting a board action`, () => {
      const engine = fixture();
      if (artifact) {
        engine.tiles.artifacts = [ArtifactToken.Credit];
        engine.move(`terrans examineArtifact. chooseArtifactToken ${ArtifactToken.Credit}. endturn`);
      } else {
        const player = engine.players[0];
        player.data.explorationShips = {};
        const home = Array.from(engine.map.grid.values()).find((hex) => hex.data.planet === Planet.Terra);
        home.data.player = player.player;
        home.data.building = Building.Mine;
        player.data.occupied.push(home);
        player.data.buildings[Building.Mine] = 1;
        engine.move("terrans explore eclipse. endturn");
      }
      const setup = new ChartSetup(engine);
      const acquisition = setup.newBarChart(
        style,
        setup.factory(artifact ? "Artifacts" : "Exploration", null),
        engine,
        (c) => c
      );
      expect(acquisition.table.datasetMeta["Terrans (1)"].total).to.equal(1);
      expect(
        Object.entries(acquisition.table.datasetMeta).find(([label]) => label.startsWith("Lantids"))[1].total
      ).to.equal(0);
      for (const type of setup.types(ChartGroup.resources)) {
        expect(() =>
          setup.newBarChart(style, setup.factory(ChartGroup.resources, type), engine, (c) => c)
        ).not.to.throw();
      }
      const board = setup.newBarChart(style, setup.factory("Board actions", null), engine, (c) => c);
      expect(Object.values(board.table.datasetMeta).every((meta) => meta.total === 0)).to.equal(true);
      if (artifact) {
        const credit = setup.newBarChart(style, setup.factory(ChartGroup.resources, "Credits"), engine, (c) => c);
        const index = credit.chart.data.labels.indexOf("Spaceships and artifacts income");
        expect(credit.chart.data.datasets.find((d) => d.label.startsWith("Terrans")).data[index]).to.equal(3);
      }
    });
  }

  it("counts an actual exhausted ship tech acquisition in the base-tech table", () => {
    const engine = fixture();
    engine.tiles.spaceshipTechs[Spaceship.Rebellion] = { tile: SpaceshipTechTile.Resource, count: 1 };
    engine.move("terrans spaceshipAction rebellion qic. tech rebellion. up nav. endturn");
    expect(engine.tiles.spaceshipTechs[Spaceship.Rebellion]).to.equal(undefined);
    const setup = new ChartSetup(engine);
    const factory = setup.factory("Base Tech Tiles", null);
    const table = setup.newBarChart(style, factory, engine, (c) => c);
    const index = factory.sources.findIndex((s) => s.type === SpaceshipTechTile.Resource);
    expect(table.chart.data.datasets.find((d) => d.label.startsWith("Terrans")).data[index]).to.equal(1);
    expect(table.table.datasetMeta["Terrans (1)"].total).to.equal(1);
    // Ship tech acquisition includes an implicit free research step. Its
    // tech-rebellion source must also be mapped in every resource breakdown.
    for (const type of setup.types(ChartGroup.resources)) {
      expect(() =>
        setup.newBarChart(style, setup.factory(ChartGroup.resources, type), engine, (c) => c)
      ).not.to.throw();
    }
    const knowledge = setup.newBarChart(style, setup.factory(ChartGroup.resources, "Knowledge"), engine, (c) => c);
    const techIncome = knowledge.chart.data.labels.indexOf("Tech Tiles income");
    expect(knowledge.chart.data.datasets.find((d) => d.label.startsWith("Terrans")).data[techIncome]).to.equal(4);
  });

  for (const [move, key] of [
    ["burn 1. spend 1o for 1c. spaceshipAction eclipse power. up nav. endturn", "eclipse:power"],
    ["spaceshipAction twilight qic. fedtile fed2. endturn", "twilight:qic"],
    ["spaceshipAction rebellion qic. tech free1. up nav. endturn", "rebellion:qic"],
    ["spaceshipAction tfmars qic. endturn", "tfmars:qic"],
  ]) {
    it(`counts actual engine execution once in charts and tables: ${key}`, () => {
      const engine = fixture();
      engine.move(`terrans ${move}`);
      expect(engine.advancedLog.some((entry) => entry.changes?.[key.split(":")[0]] != null)).to.equal(true);
      const setup = new ChartSetup(engine);
      for (const resource of balanceSheetResources) {
        const resourceFactory = setup.factory(ChartGroup.resources, balanceSheetResourceName(resource));
        expect(() => setup.newBarChart(style, resourceFactory, engine, (c) => c)).not.to.throw();
      }
      const factory = setup.factory("Board actions", null);
      const index = factory.sources.findIndex((s) => s.type === `spaceshipAction:${key}`);
      expect(index).to.be.greaterThan(-1);
      // Rebuilding the shared factory must not retain counting state.
      for (let repeat = 0; repeat < 2; repeat++) {
        const bar = setup.newBarChart(style, factory, engine, (c) => c);
        const row = bar.chart.data.datasets.find((d) => d.label === "Terrans (1)");
        expect(row).not.to.equal(undefined);
        expect(row.data[index]).to.equal(1);
        expect(row.data.reduce((a: number, b: number) => a + b, 0)).to.equal(1);
        expect(bar.table.datasetMeta["Terrans (1)"].total).to.equal(1);
        for (const other of bar.chart.data.datasets.filter((d) => d !== row)) {
          expect(other.data.every((n) => n === 0)).to.equal(true);
        }
        const line = setup.newLineChart(style, factory, engine, PlayerEnum.Player1, (c) => c);
        expect(line.data.datasets[index].data[6]).to.deep.equal({ x: 6, y: 1 });
        const breakdown = setup.newLineChart(style, factory, engine, `spaceshipAction:${key}`, (c) => c);
        expect(breakdown.data.datasets[0].data[6]).to.deep.equal({ x: 6, y: 1 });
      }
    });
  }
});
