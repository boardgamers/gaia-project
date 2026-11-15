import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { ChartSetup, lineChartKind } from "./chart-factory";
import { ChartGroup, playerLabel } from "./charts";
import endedGame from "./testdata/ended-game/test-case.json";

const style = { type: "table" as const, compact: true, label: "" };
const color = (c: string) => c;

describe("Over Time selections", () => {
  for (const lostFleet of [false, true]) {
    it(`builds every summary, player and source selection (${lostFleet ? "Lost Fleet" : "base"}) without activity`, () => {
      const engine = new Engine(
        ["init 3 overtime", "p1 faction terrans", "p2 faction itars", "p3 faction hadsch-hallas"],
        { lostFleet }
      );
      const setup = new ChartSetup(engine);
      for (const fleetView of ["Exploration", "Artifacts", "Lost Fleet activities"]) {
        expect(setup.selects.includes(fleetView)).to.equal(lostFleet);
      }
      for (const select of setup.selects) {
        const types = setup.types(select);
        for (const type of types.length ? types : [null]) {
          const factory = setup.factory(select, type);
          const summary = setup.newLineChart(style, factory, engine, lineChartKind, color);
          expect(summary.options.plugins.title.text).to.equal(factory.playerSummaryTitle);
          expect(summary.data.datasets).to.have.length(engine.players.length);
          expect(summary.options.scales.y.stacked).to.equal(false);
          expect(summary.data.datasets.map((dataset) => dataset.label)).to.deep.equal(engine.players.map(playerLabel));
          if (select === "Buildings") {
            // Before initial placement there is genuinely no activity, not a missing source.
            expect(
              summary.data.datasets.every((dataset) => dataset.data.every((point: any) => point.y === 0))
            ).to.equal(true);
          }
          for (const group of setup.kinds(engine, factory).slice(1)) {
            for (const { kind } of group) {
              const config = setup.newLineChart(style, factory, engine, kind, color);
              expect(config.data.datasets.length).to.be.greaterThan(0);
              const title =
                typeof kind === "number"
                  ? factory.singlePlayerSummaryTitle(engine.player(kind))
                  : `${factory.sources.find((source) => source.type === kind).label} of all players`;
              expect(config.options.plugins.title.text).to.equal(title);
              for (const dataset of config.data.datasets) {
                expect(dataset.data.length).to.be.greaterThan(0);
                expect(dataset.data.every((point: any) => Number.isFinite(point.y))).to.equal(true);
              }
            }
          }
        }
      }
    });
  }

  it("aggregates each player's VP sources to the same totals as Overview on a completed game", () => {
    const engine = new Engine(endedGame.moveHistory, endedGame.options as any, null, true);
    const setup = new ChartSetup(engine);
    const factory = setup.factory(ChartGroup.vp, "Overview");
    const config = setup.newLineChart(style, factory, engine, lineChartKind, color);
    const overview = setup.newBarChart(style, factory, engine, color);
    expect(config.data.labels).to.deep.equal([
      "Start",
      "Round 1",
      "Round 2",
      "Round 3",
      "Round 4",
      "Round 5",
      "Round 6",
      "Final",
    ]);
    expect(config.data.datasets.map((dataset) => dataset.label)).to.deep.equal(engine.players.map(playerLabel));
    for (const dataset of config.data.datasets) {
      const summary = Object.values(overview.table.datasetMeta).find((meta) => meta.label === dataset.label);
      expect((dataset.data[7] as any).y).to.equal(summary.total);
    }
    const playerConfig = setup.newLineChart(style, factory, engine, engine.players[0].player, color);
    expect(playerConfig.options.scales.y.stacked).to.equal("single");
  });
});
