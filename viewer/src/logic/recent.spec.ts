import { LogEntry, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { markBuilding, ownTurn, parseCommands, parsedMove, recentMoves } from "./recent";

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
        want: ["p2 faction geodens", "terrans build m 8A2"],
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
        want: ["p2 faction geodens", "terrans build m 8A2"],
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
        want: ["taklons booster booster1", "firaks booster booster3", "firaks build ts 7A0."],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const moves = recentMoves(PlayerEnum.Player2, test.give.logEntries, test.give.moveHistory);
        expect(moves.moves).to.deep.equal(
          test.want.map((m) => parsedMove(m)),
          JSON.stringify(moves)
        );
      });
    }
  });

  describe("markBuilding", () => {
    const tests: {
      name: string;
      give: { recent: number; currentRound: number; buildings: number };
      want: { currentRound: number[]; recent: number[] };
    }[] = [
      {
        name: "less recent & round than buildings",
        give: { recent: 1, currentRound: 2, buildings: 3 },
        want: { currentRound: [1, 2], recent: [2] },
      },
      {
        name: "less recent than buildings & round equal to than buildings",
        give: { recent: 1, currentRound: 3, buildings: 3 },
        want: { currentRound: [0, 1, 2], recent: [2] },
      },
      {
        name: "less recent than buildings & more round than buildings",
        give: { recent: 1, currentRound: 4, buildings: 3 },
        want: { currentRound: [0, 1, 2, 3], recent: [3] },
      },
      {
        name: "less recent than buildings & more round than possible buildings - because some buildings were upgraded",
        give: { recent: 1, currentRound: 5, buildings: 3 },
        want: { currentRound: [0, 1, 2, 3], recent: [3] },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const buildingsNumbers = [0, 1, 2, 3];
        const possibleBuildings = 4;
        const currentRound = buildingsNumbers.filter((i) =>
          markBuilding(i, test.give.currentRound, test.give.buildings, test.give.currentRound, possibleBuildings)
        );
        const recent = buildingsNumbers.filter((i) =>
          markBuilding(i, test.give.currentRound, test.give.buildings, test.give.recent, possibleBuildings)
        );

        expect(currentRound).to.deep.equal(test.want.currentRound);
        expect(recent).to.deep.equal(test.want.recent);
      });
    }
  });

  it("should parse commands correctly", () => {
    expect(parseCommands("taklons charge 1pw. brainstone area1.")).to.deep.equal([
      {
        args: ["1pw"],
        command: "charge",
        faction: "taklons",
      },
      {
        args: ["area1"],
        command: "brainstone",
        faction: "taklons",
      },
    ]);
  });

  it("charge should not be in own turn", () => {
    //more tests are in log.spec.ts (history)
    expect(ownTurn(parsedMove("geodens charge 1pw"))).to.be.false;
  });
});
