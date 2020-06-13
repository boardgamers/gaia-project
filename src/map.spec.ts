import SpaceMap, { MapConfiguration } from "./map";
import Engine from './engine';
import { Hex } from "hexagrid";
import { expect } from "chai";
import { Planet } from "./enums";

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
        p2 rotate 0x0 1
      `);

      expect(() => new Engine(moves, {advancedRules: true})).to.not.throw();
    });
  });

  it("should load from a configuration", () => {
    const conf: MapConfiguration = {
      sectors: [
        { sector: '3', rotation: 5 },
        { sector: '7B', rotation: 0 },
        { sector: '2', rotation: 3 },
        { sector: '5B', rotation: 2 },
        { sector: '4', rotation: 4 },
        { sector: '1', rotation: 0 },
        { sector: '6B', rotation: 5 }
      ]
    };

    const map = new SpaceMap();

    map.load(conf);

    expect(map.grid.get({q: -2, r: 0}).data.sector).to.equal("5B");
    expect(map.grid.get({q: -2, r: 0}).data.planet).to.equal(Planet.Transdim);
    expect(map.grid.get({q: -3, r: 1}).data.sector).to.equal("6B");
    expect(map.grid.get({q: -3, r: 1}).data.planet).to.equal(Planet.Transdim);
    expect(map.grid.get({q: -4, r: 2}).data.planet).to.equal(Planet.Terra);
  });

  it("should load from a configuration in reverse", () => {
    const conf: MapConfiguration = {
      sectors: [
        {sector: "4", rotation: 3},
        {sector: "3", rotation: 5},
        {sector: "7B", rotation: 3},
        {sector: "5B", rotation: 3},
        {sector: "6B", rotation: 4},
        {sector: "1", rotation: 0},
        {sector: "2", rotation: 3}
      ],
      mirror: true
    };

    const map = new SpaceMap();

    map.load(conf);

    expect(map.grid.get({q: 2, r: 2}).data.planet).to.equal(Planet.Empty, "2x2 != empty");
    expect(map.grid.get({q: 3, r: 2}).data.planet).to.equal(Planet.Empty, "3x2 != empty");
    expect(map.grid.get({q: 1, r: 3}).data.planet).to.equal(Planet.Ice, "1x3 != ice");
    expect(map.grid.get({q: 3, r: 3}).data.planet).to.equal(Planet.Gaia, "3x3 != gaia");
    expect(map.grid.get({q: 3, r: 1}).data.planet).to.equal(Planet.Empty, "3x1 != empty");
    expect(map.grid.get({q: 1, r: 5}).data.planet).to.equal(Planet.Terra, "1x5 != terra");
  });

  it("withinDistance should work", () => {
    const map = new SpaceMap(2);

    expect(map.withinDistance({q: 0, r: 0, s: 0}, 2)).to.have.length(19);
  });

  it ("should be fine with new coordinate system", () => {
    const map = new SpaceMap(4, "big");

    // expect(map.grid)
  });
});
