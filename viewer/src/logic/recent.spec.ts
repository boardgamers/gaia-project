import { Command, LogEntry, PlayerEnum, ResearchField } from "@gaia-project/engine";
import { expect } from "chai";
import {
  boardActionMoves,
  commandArgsByFaction,
  hexMoveLabel,
  hexMovesByHex,
  markBuilding,
  opponentMovesSinceLastTurn,
  ownTurn,
  parseCommands,
  parsedMove,
  recentMoves,
  spaceshipActionKey,
  spaceshipActionMoves,
} from "./recent";

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

  it("returns only opponent turns after the viewer's previous turn", () => {
    const slice = {
      index: 1,
      moves: [
        parsedMove("terrans up gaia"),
        parsedMove("xenos charge 2pw"),
        parsedMove("xenos build m 8A2"),
        parsedMove("geodens build ts 3A4"),
      ],
      allMoves: [],
    };

    expect(opponentMovesSinceLastTurn(slice).map((move) => move.move)).to.deep.equal([
      "xenos build m 8A2",
      "geodens build ts 3A4",
    ]);
  });

  describe("boards touched by a move", () => {
    const commands = [
      parsedMove("xenos up nav"),
      parsedMove("geodens action power3. build m 3A4"),
      parsedMove("terrans spaceshipAction twilight power. build lab 4B2"),
      parsedMove("terrans up terra."),
      parsedMove("xenos special 4pw"),
      parsedMove("geodens explore twilight"),
      parsedMove("terrans examineArtifact. chooseArtifactToken artifact-power"),
    ].flatMap((move) => move.commands);

    it("groups research upgrades by faction", () => {
      const research = commandArgsByFaction<ResearchField>(commands, Command.UpgradeResearch);

      expect([...research.keys()]).to.deep.equal(["xenos", "terrans"]);
      expect([...research.get("xenos")]).to.deep.equal([ResearchField.Navigation]);
      expect([...research.get("terrans")]).to.deep.equal([ResearchField.Terraforming]);
    });

    it("collects power/QIC actions", () => {
      expect([...boardActionMoves(commands)]).to.deep.equal(["power3"]);
    });

    it("collects spaceship actions by ship and type", () => {
      expect([...spaceshipActionMoves(commands)]).to.deep.equal([spaceshipActionKey("twilight", "power")]);
    });

    it("groups special actions, explorations and artifacts by faction", () => {
      expect([...commandArgsByFaction(commands, Command.Special)]).to.deep.equal([["xenos", new Set(["4pw"])]]);
      expect([...commandArgsByFaction(commands, Command.Explore)]).to.deep.equal([["geodens", new Set(["twilight"])]]);
      expect([...commandArgsByFaction(commands, Command.ChooseArtifactToken)]).to.deep.equal([
        ["terrans", new Set(["artifact-power"])],
      ]);
    });
  });

  describe("hexMovesByHex", () => {
    // A map stub is all this needs: it only asks for the hex behind a coordinate.
    const hex = (coordinate: string) => ({ toString: () => coordinate });
    const data = { map: { getS: (coordinate: string) => hex(coordinate) } } as any;

    it("marks builds, gaiaforming, the Lost Planet, Power Rings and every federation member", () => {
      const commands = [
        parsedMove("terrans build m 3A4"),
        parsedMove("geodens gaiaFormTransdim 5B2"),
        parsedMove("xenos lostPlanet 1A0"),
        parsedMove("moweyds placePowerRing 2A1"),
        parsedMove("terrans federation 7A2,7A3,7B1 fed2"),
      ].flatMap((move) => move.commands);

      const marked = hexMovesByHex(data, commands);

      expect([...marked.keys()].map((h) => h.toString())).to.deep.equal([
        "3A4",
        "5B2",
        "1A0",
        "2A1",
        "7A2",
        "7A3",
        "7B1",
      ]);
      expect([...marked.values()].map((command) => hexMoveLabel(command))).to.deep.equal([
        "build m",
        "gaiaform",
        "place the Lost Planet",
        "place a Power Ring",
        "form a federation",
        "form a federation",
        "form a federation",
      ]);
    });

    it("leaves an argument that isn't a coordinate unmarked instead of throwing", () => {
      const throwing = {
        map: {
          getS: () => {
            throw new Error("not a coordinate");
          },
        },
      } as any;

      expect(hexMovesByHex(throwing, parsedMove("terrans build m nowhere").commands).size).to.equal(0);
    });
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
    expect(parseCommands("taklons charge 1pw. brainstone area1 (0 ⇒ 1). (0/0/6/0 ⇒ 3/0/3/0)")).to.deep.equal([
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
