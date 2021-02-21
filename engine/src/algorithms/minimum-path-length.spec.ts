import { expect } from "chai";
import { Hex } from "hexagrid";
import minimumPathLength from "./minimum-path-length";

describe("minimum path length", () => {
  it("should get 4 with those 4 hexes in that order", () => {
    const minCost = minimumPathLength([[new Hex(-2, 10)], [new Hex(0, 3)], [new Hex(-2, 7)], [new Hex(-1, 5)]]);

    expect(minCost).to.equal(4);
  });
});
