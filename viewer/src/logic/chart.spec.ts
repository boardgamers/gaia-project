import Engine, { Faction, LogEntry, Player } from "@gaia-project/engine";
import { expect } from "chai";
// Here we import the File System module of node
import fs from "fs";
import { families, newBarChart } from "./chart-factory";
import { ChartFamily } from "./charts";
import { countResearch } from "./victory-point-charts";

describe("Chart", () => {
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
    const base = "src/logic/chartTests/";
    fs.readdirSync(base).map((testCaseName) => {
      describe(testCaseName, () => {
        const testCaseDir = base + testCaseName;
        const testCase = JSON.parse(fs.readFileSync(testCaseDir + "/test-case.json").toString());

        const engine = new Engine(testCase.moveHistory, testCase.options);

        const allFamilies = testCase.families.flatMap((f) => (f == "all" ? families() : [f as ChartFamily]));
        for (const family of allFamilies) {
          it(family, () => {
            const path = `${testCaseDir}/${family.replace(/ /g, "-").toLowerCase()}.json`;
            const config = newBarChart({ type: "table", label: "Table", compact: false }, family, engine, null);
            const actual = {
              tableMeta: config.table,
              labels: config.chart.data.labels,
              datasets: config.chart.data.datasets.map((s) => ({ label: s.label, data: s.data })),
            };
            expect(actual).to.deep.equal(
              JSON.parse(fs.readFileSync(path).toString()),
              `${path}:\n${JSON.stringify(actual)}\n`
            );
          });
        }
      });
    });
  });
});
