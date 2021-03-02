import { Faction, LogEntry } from "@gaia-project/engine";
import { expect } from "chai";
import { countResearch } from "./charts";

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
        const c = countResearch(test.give.moveHistory, Faction.Terrans);
        const n = test.give.logEntries.map((e) => c(e));

        expect(n).to.deep.equal(test.want);
      });
    }
  });
});
