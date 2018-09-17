import SpaceMap from "./map";
import Engine from './engine';
import { Hex } from "hexagrid";
import { expect } from "chai";

describe("Map", () => {
  it("should have the appropriate number of hexagons", () => {
    const smallMap = new SpaceMap(2, "small");
    expect(smallMap.grid.size).to.equal(Hex.hexagon(2).length * 7, "small map is of wrong size");

    const bigMap = new SpaceMap(4, "big");
    expect(bigMap.grid.size).to.equal(Hex.hexagon(2).length * 10, "big map is of wrong size");
  });

  describe("rotateSectors", () => {
    it ("should throw when rotating sectors and creating an invalid map", () => {
      const moves = Engine.parseMoves(`
        init 2 randomSeed
        p2 rotate 0x0 2
      `);

      expect(() => new Engine(moves, {advancedRules: true})).to.throw();
    });

    it ("should not throw when rotating sectors and creating a valid map", () => {
      const moves = Engine.parseMoves(`
        init 2 randomSeed
        p2 rotate 0x0 5
      `);

      expect(() => new Engine(moves, {advancedRules: true})).to.throw();
    });
  });
});
