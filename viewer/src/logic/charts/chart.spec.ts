import Engine, { Faction, LogEntry, Player, ResearchField, Reward } from "@gaia-project/engine";
import { expect } from "chai";
import { runJsonTests } from "../test-utils";
import { ChartSetup } from "./chart-factory";
import { ChartType } from "./charts";
import { countResearch, ResearchCounter } from "./research";

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
    expect(new ResearchCounter(p).playerData.research[ResearchField.Navigation]).to.equal(2);
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
      baseDir: "src/logic/charts/testdata",
      subTests: (testCase: any) => {
        const setup = new ChartSetup(new Engine(["init 2 foo"]));
        return testCase.types.flatMap((f) =>
          f == "all"
            ? setup.selects.flatMap((s) => {
                const types = setup.types(s);
                return types.length == 0 ? [s] : types.map((t) => `${s}/${t}`);
              })
            : [f as ChartType]
        );
      },
      replay: true,
      createActualOutput: (engine, fullType, testCase: any) => {
        const setup = new ChartSetup(engine, testCase.statistics);
        const i = fullType.indexOf("/");
        const config = setup.newBarChart(
          {
            type: "table",
            label: "Table",
            compact: false,
          },
          setup.factory(i > 0 ? fullType.substring(0, i) : fullType, i > 1 ? fullType.substring(i + 1) : null),
          engine,
          null,
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
