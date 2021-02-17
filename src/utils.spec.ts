import { expect } from "chai";
import { combinations } from "./utils";

describe("Utils", () => {
  describe("combinations", () => {
    const tests: {
      name: string;
      give: number[];
      want: number[][];
    }[] = [
      {
        name: "empty",
        give: [],
        want: [[]],
      },
      {
        name: "1,2,3",
        give: [1, 2, 3],
        want: [[], [1], [2], [2, 1], [3], [3, 1], [3, 2], [3, 2, 1]],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const target = combinations(test.give);
        expect(target).to.deep.equal(test.want);
      });
    }
  });
});
