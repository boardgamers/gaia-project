import { expect } from "chai";
import { Hex } from "hexagrid";
import Engine from "./engine";
import { Faction, Planet, Player } from "./enums";
import { generateLostFleetBoard } from "./lost-fleet-board";
import { deepSpaceTileCount, interspaceSet, lostFleetSectorCenters } from "./lost-fleet-map";
import SpaceMap, { MapConfiguration } from "./map";

describe("Map", () => {
  it("should have the appropriate number of hexagons", () => {
    const smallMap = new SpaceMap(2, "small");
    expect(smallMap.grid.size).to.equal(Hex.hexagon(2).length * 7, "small map is of wrong size");

    const bigMap = new SpaceMap(4, "big");
    expect(bigMap.grid.size).to.equal(Hex.hexagon(2).length * 10, "big map is of wrong size");
  });

  describe("rotateSectors", () => {
    it("should throw when rotating sectors and creating an invalid map", () => {
      const moves = Engine.parseMoves(`
        init 2 randomSeed
        p2 rotate 0x0 2
      `);

      expect(() => new Engine(moves, { advancedRules: true })).to.throw();
    });

    it("should not throw when rotating sectors and creating a valid map", () => {
      const moves = Engine.parseMoves(`
        init 2 randomSeed
        p2 rotate 0x0 1
      `);

      expect(() => new Engine(moves, { advancedRules: true })).to.not.throw();
    });
  });

  it("should load from a configuration", () => {
    const conf: MapConfiguration = {
      sectors: [
        { sector: "3", rotation: 5 },
        { sector: "7B", rotation: 0 },
        { sector: "2", rotation: 3 },
        { sector: "5B", rotation: 2 },
        { sector: "4", rotation: 4 },
        { sector: "1", rotation: 0 },
        { sector: "6B", rotation: 5 },
      ],
    };

    const map = new SpaceMap();

    map.load(conf);

    expect(map.grid.get({ q: -2, r: 0 }).data.sector).to.equal("5B");
    expect(map.grid.get({ q: -2, r: 0 }).data.planet).to.equal(Planet.Transdim);
    expect(map.grid.get({ q: -3, r: 1 }).data.sector).to.equal("6B");
    expect(map.grid.get({ q: -3, r: 1 }).data.planet).to.equal(Planet.Transdim);
    expect(map.grid.get({ q: -4, r: 2 }).data.planet).to.equal(Planet.Terra);
  });

  it("should load from a configuration in reverse", () => {
    const conf: MapConfiguration = {
      sectors: [
        { sector: "4", rotation: 3 },
        { sector: "3", rotation: 5 },
        { sector: "7B", rotation: 3 },
        { sector: "5B", rotation: 3 },
        { sector: "6B", rotation: 4 },
        { sector: "1", rotation: 0 },
        { sector: "2", rotation: 3 },
      ],
      mirror: true,
    };

    const map = new SpaceMap();

    map.load(conf);

    expect(map.grid.get({ q: 2, r: 2 }).data.planet).to.equal(Planet.Empty, "2x2 != empty");
    expect(map.grid.get({ q: 3, r: 2 }).data.planet).to.equal(Planet.Empty, "3x2 != empty");
    expect(map.grid.get({ q: 1, r: 3 }).data.planet).to.equal(Planet.Ice, "1x3 != ice");
    expect(map.grid.get({ q: 3, r: 3 }).data.planet).to.equal(Planet.Gaia, "3x3 != gaia");
    expect(map.grid.get({ q: 3, r: 1 }).data.planet).to.equal(Planet.Empty, "3x1 != empty");
    expect(map.grid.get({ q: 1, r: 5 }).data.planet).to.equal(Planet.Terra, "1x5 != terra");
  });

  it("withinDistance should work", () => {
    const map = new SpaceMap(2);

    expect(map.withinDistance({ q: 0, r: 0, s: 0 }, 2)).to.have.length(19);
  });

  it("should be fine with new coordinate system", () => {
    const map = new SpaceMap(4, "big");

    // expect(map.grid)
  });

  describe("Lost Fleet", () => {
    const SECTOR_COUNT: { [nbPlayers: number]: number } = { 2: 7, 3: 9, 4: 10 };

    function expectedHexCount(nbPlayers: number): number {
      return SECTOR_COUNT[nbPlayers] * 19 + interspaceSet(nbPlayers).total + deepSpaceTileCount(nbPlayers) * 3;
    }

    it("should build the same board as generateLostFleetBoard for a given seed", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const seed = `map-lost-fleet-${nbPlayers}`;
        const map = new SpaceMap(nbPlayers, seed, false, "standard", true);
        const board = generateLostFleetBoard(nbPlayers, seed);

        expect(map.lostFleet).to.equal(true);
        expect([...map.grid.values()].map((h) => h.toJSON())).to.deep.equal(
          [...board.grid.values()].map((h) => h.toJSON())
        );
        expect(map.grid.size).to.equal(expectedHexCount(nbPlayers));
      }
    });

    it("should exclude spaceship hexes from federation satellite routing", () => {
      const map = new SpaceMap(3, "lost-fleet-federation-ship-hexes", false, "standard", true);
      const excluded = map.excludedHexesForBuildingFederation(Player.Player1, Faction.Terrans);
      const shipHexes = [...map.grid.values()].filter((hex) => hex.hasSpaceship());

      expect(shipHexes).to.not.be.empty;
      for (const shipHex of shipHexes) {
        expect(excluded.has(shipHex), `${shipHex.toString()} should be excluded from federation paths`).to.be.true;
      }
    });

    it("should round-trip every hex through toString()/getS(), across Space, Interspace, and Deep Space", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const map = new SpaceMap(nbPlayers, `roundtrip-${nbPlayers}`, false, "standard", true);
        for (const hex of map.grid.values()) {
          expect(map.getS(hex.toString()), `round-trip of ${hex.toString()}`).to.equal(hex);
        }
      }
    });

    it("should accept rotating a real Lost Fleet sector center and reject a non-center coordinate", () => {
      const map = new SpaceMap(2, "rotate-lost-fleet", false, "standard", true);
      const [origin] = lostFleetSectorCenters(2);

      expect(() => map.rotateSector(`${origin.q}x${origin.r}`, 1)).to.not.throw();
      expect(() => map.rotateSector("999x999", 1)).to.throw();
    });

    it("should preserve hex count with no coordinate collisions after a Lost Fleet sector rotation", () => {
      const map = new SpaceMap(2, "rotate-structural-lost-fleet", false, "standard", true);
      const [origin] = lostFleetSectorCenters(2);
      const sizeBefore = map.grid.size;

      map.rotateSector(`${origin.q}x${origin.r}`, 1);
      map.recalibrate();

      expect(map.grid.size).to.equal(sizeBefore);
      expect(() => map.isValid()).to.not.throw();
    });

    it("should reject combining Lost Fleet with a custom map configuration or custom board setup", () => {
      expect(
        () =>
          new Engine(["init 2 randomSeed"], {
            lostFleet: true,
            map: { sectors: [{ sector: "1", rotation: 0 }] },
          })
      ).to.throw();

      expect(() => new Engine(["init 2 randomSeed"], { lostFleet: true, customBoardSetup: true })).to.throw();
    });

    it("should build a Lost Fleet-shaped board end-to-end via Engine, distinct from the base game", () => {
      const engine = new Engine(["init 2 lost-fleet-engine-seed"], { lostFleet: true });

      expect(engine.map.lostFleet).to.equal(true);
      expect(engine.map.grid.size).to.equal(expectedHexCount(2));
      expect(engine.map.grid.size).to.not.equal(Hex.hexagon(2).length * 7);
    });

    it("should throw the German-rules assert via moveRotateSectors when a rotation puts two matching planet types adjacent", () => {
      const moves = Engine.parseMoves(`
        init 2 lost-fleet-space-map
        p2 rotate 0x0 3
      `);

      expect(() => new Engine(moves, { lostFleet: true, advancedRules: true })).to.throw(
        "Map is invalid with two planets for the same type being near each other"
      );
    });

    it("should preserve the Lost Fleet board through a serialization round trip", () => {
      const engine = new Engine(["init 3 lost-fleet-serialize-seed"], { lostFleet: true });
      const restored = Engine.fromData(JSON.parse(JSON.stringify(engine)));

      expect(restored.map.lostFleet).to.equal(true);
      expect(restored.map.grid.size).to.equal(engine.map.grid.size);

      const sample = [...engine.map.grid.values()][0];
      expect(restored.map.getS(sample.toString())?.data.sector).to.equal(sample.data.sector);
    });
  });
});
