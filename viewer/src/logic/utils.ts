import Engine, { Phase } from "@gaia-project/engine";
import { expect } from "chai";
import fs from "fs";

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction
  );
}

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

export function runJsonTests(tester: JsonTester) {
  runMoveHistoryTests(tester.baseDir + "/", (testCaseDir: string, testCase: any) => {
    let engine: Engine = null;
    for (const subTest of tester.subTests(testCase)) {
      it(subTest, () => {
        const path = `${testCaseDir}/${subTest.replace(/ /g, "-").toLowerCase()}.json`;
        if (engine == null) {
          engine = new Engine(testCase.moveHistory, testCase.options, null, tester.replay);
        }
        const actual = tester.createActualOutput(engine, subTest, testCase);
        expect(actual).to.deep.equal(
          JSON.parse(fs.readFileSync(path).toString()),
          `${path}:\n${JSON.stringify(actual)}\n`
        );
      });
    }
  });
}

export function getMapHex(map, location: string) {
  const { q, r } = map.parse(location);
  return map.grid.get({ q, r });
}

export const deltaCounter: (initial: number) => (val: number) => number = (initial: number) => {
  let last = 0;

  return (val: number) => {
    const ret = val - last;
    last = val;
    return ret;
  };
};
