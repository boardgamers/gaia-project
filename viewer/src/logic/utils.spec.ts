import { expect } from "chai";
import { rotate } from "./utils";

describe("Utils", () => {
  describe("rotate", () => {
    const tests: {
      name: string;
      give: string[];
      want: string[];
    }[] = [
      {
        name: "sorted",
        give: ["s", "1", "2"],
        want: ["s", "1", "2"],
      },
      {
        name: "not sorted",
        give: ["1", "s", "2", "3"],
        want: ["s", "2", "3", "1"],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        expect(rotate(test.give, "s")).to.deep.equal(test.want);
      });
    }
  });
});
