import { LogEntry, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { recentMoves } from "./recent";

describe("Moves", () => {
  describe("recentMoves", () => {
    const tests: {
      name: string;
      give: { moveHistory: string[]; logEntries: LogEntry[] };
      want: string[];
    }[] = [
      {
        name: "player starts",
        give: {
          moveHistory: [
            "init 2 randomSeed2",
            "p2 rotate",
            "p1 faction terrans",
            "p2 faction geodens",
            "terrans build m 8A2",
          ],
          logEntries: [
            { player: 1, move: 1 },
            { player: 0, move: 2 },
            { player: 1, move: 3 },
            { player: 0 },
            { player: 1 },
            { player: 0, move: 4 },
          ],
        },
        want: ["terrans build m 8A2"],
      },
      {
        name: "player is about to place second mine",
        give: {
          moveHistory: [
            "init 2 randomSeed2",
            "p2 rotate",
            "p1 faction terrans",
            "p2 faction geodens",
            "terrans build m 8A2",
            "geodens build m 1A5",
          ],
          logEntries: [
            { player: 1, move: 1 },
            { player: 0, move: 2 },
            { player: 1, move: 3 },
            { player: 0 },
            { player: 1 },
            { player: 0, move: 4 },
            { player: 1, move: 5 },
          ],
        },
        want: ["terrans build m 8A2"],
      },
      {
        name: "ignores charge and brainstone",
        give: {
          moveHistory: [
            "init 2 randomSeed2",
            "p2 rotate",
            "p1 faction firaks",
            "p2 faction taklons",
            "firaks build m 7A0",
            "taklons build m 2B3",
            "taklons build m 4B3",
            "firaks build m 4A10",
            "taklons booster booster1",
            "firaks booster booster3",
            "firaks build ts 7A0.",
            "taklons charge 1pw. brainstone area1",
          ],
          logEntries: [
            { player: 1, move: 1 },
            { player: 0, move: 2 },
            { player: 1, move: 3 },
            { player: 0, move: 4 },
            { player: 1, move: 5 },
            { player: 1, move: 6 },
            { player: 0, move: 7 },
            { player: 1, move: 8 },
            { player: 0, move: 9 },
            { player: 0, move: 10 },
            { player: 1, move: 11 },
            { player: 1, move: 12 },
          ],
        },
        want: ["firaks booster booster3", "firaks build ts 7A0."],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const moves = recentMoves(PlayerEnum.Player2, test.give.logEntries, test.give.moveHistory);
        expect(moves).to.deep.equal(test.want);
      });
    }
  });
});
