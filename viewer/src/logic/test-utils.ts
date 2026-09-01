import Engine from "@gaia-project/engine";
import type { expect } from "chai";
import fs from "fs";

export type JsonTester = {
  baseDir: string;
  subTests: (testCase: any) => string[];
  createActualOutput: (data: Engine, subTest: string, testCase: any) => any;
  replay: boolean;
};

export function runMoveHistoryTests(base: string, engineTest: (testCaseDir: string, testCase: any) => void) {
  fs.readdirSync(base).map((testCaseName) => {
    describe(testCaseName, () => {
      const testCaseDir = base + testCaseName;
      const testCase = JSON.parse(fs.readFileSync(testCaseDir + "/test-case.json").toString());

      console.log(testCaseName);
      engineTest(testCaseDir, testCase);
    });
  });
}

/**
 * Some chart snapshots predate the correction of Ivits' starting power from the engine's old 2/4
 * default to the board's actual 2/2. Recreate that explicitly tagged historical starting state so
 * the fixtures continue testing chart/resource accounting without weakening current game rules.
 */
export function createFixtureEngine<T extends Engine>(testCase: any, factory: (moves: string[]) => T): T {
  const moves = testCase.moveHistory as string[];
  if (!testCase.legacyIvitsStartingPower) {
    return factory(moves);
  }

  const ivitsSelection = moves.findIndex((move) => move.includes(" faction ivits"));
  if (ivitsSelection < 0) {
    throw new Error("legacyIvitsStartingPower requires an Ivits faction-selection move");
  }

  const selection = /^p(\d+) faction ivits/.exec(moves[ivitsSelection]);
  if (!selection) {
    throw new Error("The historical Ivits fixture must select the faction by player number");
  }
  const engine = factory(moves.slice(0, ivitsSelection));
  engine.players[Number(selection[1]) - 1].variant = {
    board: { power: { area1: 2, area2: 4 } },
    version: 0,
  };
  engine.loadMoves(moves.slice(ivitsSelection));
  return engine;
}

export function runJsonTests(tester: JsonTester) {
  runMoveHistoryTests(tester.baseDir + "/", (testCaseDir: string, testCase: any) => {
    let engine: Engine = null;
    for (const subTest of tester.subTests(testCase)) {
      it(subTest, () => {
        const path = `${testCaseDir}/${subTest.replace(/\./g, "").replace(/[\/ ]/g, "-").toLowerCase()}.json`;
        if (engine == null) {
          engine = createFixtureEngine(testCase, (moves) => new Engine(moves, testCase.options, null, tester.replay));
        }
        const actual = JSON.stringify(tester.createActualOutput(engine, subTest, testCase));
        expect(actual).to.deep.equal(
          JSON.stringify(JSON.parse(fs.readFileSync(path).toString())),
          `${path}:\n${actual}\n`
        );
      });
    }
  });
}

export function findFirstBad<T>(array: Array<T>, isBad: (T) => boolean, from = 0, to = array.length): number {
  const middle = Math.floor((to - from) / 2);
  const first = array.slice(0, to - middle);
  const bad = isBad(first);
  if (middle == 0) {
    return bad ? to : null;
  }
  if (bad) {
    return findFirstBad(array, isBad, from, to - middle);
  }
  return findFirstBad(array, isBad, from + middle, to);
}
