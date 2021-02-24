import Engine, { LogEntry, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { recentMoves, roundMoves } from "./recent";

describe("Moves", () => {
  describe("recentMoves and roundMoves", () => {
    const tests: {
      name: string;
      give: { moveHistory: string[] };
      want: { recentMoves: string[]; roundMoves: string[] };
    }[] = [
      {
        name: "player starts",
        give: {
          moveHistory: [
            "init 2 randomSeed2",
            "p1 faction terrans",
            "p2 faction geodens",
            "terrans build m 8A2",
          ],
        },
        want: {
          recentMoves: ["terrans build m 8A2"],
          roundMoves: ["p2 rotate", "p1 faction terrans", "p2 faction geodens", "terrans build m 8A2"],
        },
      },
      {
        name: "player is about to place second mine",
        give: {
          moveHistory: [
            "init 2 randomSeed2",
            "p1 faction terrans",
            "p2 faction geodens",
            "terrans build m 8A2",
            "geodens build m 1A5",
          ],
        },
        want: { recentMoves: ["terrans build m 8A2"], roundMoves: [] },
      },
      {
        name: "ignores charge and brainstone",
        give: {
          moveHistory: [
            "init 2 randomSeed2",
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
        },
        want: { recentMoves: ["firaks booster booster3", "firaks build ts 7A0."], roundMoves: [] },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const engine = new Engine();
        engine.loadMoves(test.give.moveHistory);
        const recent = recentMoves(PlayerEnum.Player2, engine.advancedLog, engine.moveHistory);
        expect(recent).to.deep.equal(test.want.recentMoves);

        const round = roundMoves(engine.advancedLog, engine.moveHistory);
        expect(round).to.deep.equal(test.want.roundMoves);
      });
    }
  });
});
