import { expect } from "chai";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const original = require("shuffle-seed");
import vendored from "./shuffle";

describe("vendored shuffle-seed", () => {
  const seeds = ["djfjjv4k", "e2e-seed", "none", "12345", "Gaia-Project!", "9zNkbGXKV3iMYT2"];
  const arrays = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ["terrans", "lantids", "xenos", "gleens", "taklons", "ambas", "hadsch-hallas", "ivits"],
    [],
    ["single"],
    Array.from({ length: 40 }, (_, i) => `sector-${i}`),
  ];

  it("produces byte-identical permutations to the original package", () => {
    for (const seed of seeds) {
      for (const arr of arrays) {
        expect(vendored.shuffle([...arr], seed)).to.deep.equal(original.shuffle([...arr], seed), `shuffle ${seed}`);
        expect(vendored.unshuffle([...arr], seed)).to.deep.equal(
          original.unshuffle([...arr], seed),
          `unshuffle ${seed}`
        );
      }
    }
  });

  it("round-trips shuffle/unshuffle", () => {
    const arr = ["a", "b", "c", "d", "e"];
    expect(vendored.unshuffle(vendored.shuffle(arr, "seed"), "seed")).to.deep.equal(arr);
  });
});
