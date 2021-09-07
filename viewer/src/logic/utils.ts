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
  createActualOutput: (data: Engine, subTest: string) => any;
};

export function runJsonTests(tester: JsonTester) {
  const base = tester.baseDir + "/";
  fs.readdirSync(base).map((testCaseName) => {
    describe(testCaseName, () => {
      const testCaseDir = base + testCaseName;
      const testCase = JSON.parse(fs.readFileSync(testCaseDir + "/test-case.json").toString());

      console.log(testCaseName);
      const engine = new Engine(testCase.moveHistory, testCase.options, null, false);

      for (const subTest of tester.subTests(testCase)) {
        it(subTest, () => {
          const path = `${testCaseDir}/${subTest.replace(/ /g, "-").toLowerCase()}.json`;
          const actual = tester.createActualOutput(engine, subTest);
          expect(actual).to.deep.equal(
            JSON.parse(fs.readFileSync(path).toString()),
            `${path}:\n${JSON.stringify(actual)}\n`
          );
        });
      }
    });
  });
}
