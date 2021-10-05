import { PlayerData, PowerArea } from "@gaia-project/engine";
import { BrainstoneDest } from "@gaia-project/engine/src/player-data";
import { expect } from "chai";
import { parseCommands } from "../recent";
// Here we import the File System module of node
import { BrainstoneSimulator } from "./resource-counter";

describe("Resource Counter", () => {
  describe("brainstone simulator", () => {
    const tests: {
      name: string;
      give: { move: string };
      want: BrainstoneDest[];
    }[] = [
      {
        name: "only brainstone command",
        give: {
          move: "taklons brainstone area1",
        },
        want: [PowerArea.Area1],
      },
      {
        name: "multiple only brainstone command",
        give: {
          move: "taklons brainstone area1. build m 1A1. brainstone discard",
        },
        want: [PowerArea.Area1, "discard"],
      },
      {
        name: "not decided yet",
        give: {
          move: "taklons action power7",
        },
        want: [undefined],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const data = new PlayerData();
        const simulator = new BrainstoneSimulator(data);
        simulator.setTurnCommands(parseCommands(test.give.move));
        for (const want of test.want) {
          expect(simulator.nextDest()).to.equal(want);
        }
      });
    }
  });
});
