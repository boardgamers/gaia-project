import Engine, { Faction, LogEntry, Player, ResearchField, Reward } from "@gaia-project/engine";
import { expect } from "chai";
import { ChartSetup } from "./chart-factory";
// Here we import the File System module of node
import { ChartFamily, initialResearch } from "./charts";
import { runJsonTests } from "./utils";
import { countResearch } from "./victory-point-charts";

describe("Chart", () => {
  describe("initial research", () => {
    const p = {
      board: {
        income: [
          {
            rewards: Reward.parse("up-nav,up-nav"),
          },
        ],
      },
    } as Player;
    expect(initialResearch(p).get(ResearchField.Navigation)).to.equal(2);
  });

  describe("count research", () => {
    const tests: {
      name: string;
      give: { moveHistory: string[]; logEntries: LogEntry[] };
      want: number[];
    }[] = [
      {
        name: "up to level 3",
        give: {
          moveHistory: ["terrans up sci. up sci", "terrans up sci"],
          logEntries: [{ round: 1 }, { player: 0, move: 0 }, { round: 2 }, { player: 0, move: 1 }],
        },
        want: [0, 0, 0, 4],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const p = { faction: Faction.Terrans } as Player;
        const c = countResearch(p);
        const n = test.give.logEntries.map((e) => c(test.give.moveHistory, e));

        expect(n).to.deep.equal(test.want);
      });
    }
  });

  describe("chart data", () => {
    runJsonTests({
      baseDir: "src/logic/chartTests",
      subTests: (testCase: any, engine: Engine) =>
        testCase.families.flatMap((f) => (f == "all" ? new ChartSetup(engine).families : [f as ChartFamily])),
      createActualOutput: (engine, family, testCase: any) => {
        const config = new ChartSetup(engine, testCase.statistics).newBarChart(
          { type: "table", label: "Table", compact: false },
          family,
          engine,
          null
        );
        return {
          tableMeta: config.table,
          labels: config.chart.data.labels,
          datasets: config.chart.data.datasets.map((s) => ({ label: s.label, data: s.data })),
        };
      },
    });
  });
});
