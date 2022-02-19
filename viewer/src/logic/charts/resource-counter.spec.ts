import Engine, {
  BrainstoneDest,
  Command,
  EventSource,
  Phase,
  PlayerData,
  PlayerEnum,
  PowerArea,
  Resource,
} from "@gaia-project/engine";
import { expect } from "chai";
import { isGaiaMove } from "../../data/log";
import { parseCommands } from "../recent";
import { runMoveHistoryTests } from "../test-utils";
import {
  BrainstoneSimulator,
  flattenChanges,
  isLastChange,
  newResourceSimulator,
  parsePowerUsage,
} from "./resource-counter";
import { ExtractLog, logEntryProcessor } from "./simple-charts";

function runResourceCounterTest(testCase: any, wantPlayer: PlayerEnum) {
  const wantProps = new Map<number, string>();
  let logIndex = 0;

  const getProps = (d: PlayerData): string => {
    const res = {};
    for (const prop of ["victoryPoints", "credits", "ores", "qics", "knowledge", "power", "brainstone"]) {
      res[prop] = d[prop];
    }
    return JSON.stringify(res);
  };

  class TestEngine extends Engine {
    move(_move: string, allowIncomplete = true) {
      const playerToMove = this.playerToMove;

      super.move(_move, allowIncomplete);
      this.savePlayerState(playerToMove);
    }

    private savePlayerState(player: PlayerEnum) {
      if (player == wantPlayer) {
        wantProps.set(this.advancedLog.length - 1, getProps(this.player(wantPlayer).data));
      }
    }

    log(player: PlayerEnum, resource: Resource, amount: number, source: EventSource) {
      super.log(player, resource, amount, source);
      this.savePlayerState(player);
    }
  }

  const engine = new TestEngine(testCase.moveHistory, testCase.options, new Engine().version, true);
  const player = engine.player(wantPlayer);

  const simulator = newResourceSimulator(player, engine.expansions);

  function assertResources(want: string, args: () => string) {
    const got = getProps(simulator.playerData);
    if (got != want) {
      console.log("want", want);
      console.log("got", got);
      console.log("args", args());
      console.log("history", JSON.stringify(engine.advancedLog));
      expect(got).to.deep.equal(want);
    }
  }

  let round = 0;
  let ended = false;

  const counter = ExtractLog.new(() => (a) => {
    simulator.simulateResources(a);

    if (a.log.round) {
      round = a.log.round;
    }
    if (a.log.phase == Phase.EndGame) {
      ended = true;
    }

    if (a.log.player == wantPlayer && round > 0 && !ended && isLastChange(a) && !isGaiaMove(a.allCommands)) {
      assertResources(wantProps.get(logIndex), () => {
        const s = Object.assign({}, a);
        delete s.data;
        return JSON.stringify(s);
      });
    }

    return 0;
  });

  const processor = counter.processor(player, null, engine);
  const logProcessor = logEntryProcessor((cmd, log, allCommands, cmdIndex) =>
    processor({
      cmd,
      allCommands,
      cmdIndex,
      source: null,
      data: engine,
      log,
    })
  );

  const history = engine.moveHistory;
  engine.advancedLog.forEach((entry, index) => {
    logIndex = index;
    logProcessor(history, entry);
  });

  assertResources(getProps(engine.player(wantPlayer).data), () => "Game ended");
}

describe("Resource Counter", () => {
  it("brainstone simulator", () => {
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

  it("parse power usage", () => {
    const usage = parsePowerUsage(
      parseCommands("terrans build gf 6A7 using area1: 4 area2: 2, brainstone: 1 (4/0/0/0 ⇒ 3/0/0/0).")[0]
    );
    expect(usage).to.deep.equal({ area1: 4, area2: 2, area3: 0, brainstone: 1 });
  });

  it("flattenChanges", () => {
    const c = flattenChanges(
      { income: { [Resource.Credit]: 2 }, booster1: { [Resource.Credit]: 3 } },
      Command.ChooseIncome
    );
    expect(c).to.deep.equal({ income: { [Resource.Credit]: 5 } });
  });

  describe("compare resource simulator to engine", () => {
    runMoveHistoryTests("src/logic/charts/testdata/", (testCaseDir, testCase) => {
      const players = Number(testCase.moveHistory[0].split(" ")[1]);
      for (let i = 0; i < players; i++) {
        it("test player " + i, () => {
          runResourceCounterTest(testCase, i);
        });
      }
    });
  });
});
