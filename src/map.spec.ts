import SpaceMap from "./map";
import { Hex } from "hexagrid";
import { expect } from "chai";

describe("Map", () => {
  it("should have the appropriate number of hexagons", () => {
    const smallMap = new SpaceMap(2, "small");
    expect(smallMap.grid.size).to.equal(Hex.hexagon(2).length * 7, "small map is of wrong size");

    const bigMap = new SpaceMap(4, "big");
    expect(bigMap.grid.size).to.equal(Hex.hexagon(2).length * 10, "big map is of wrong size");
  });
});
