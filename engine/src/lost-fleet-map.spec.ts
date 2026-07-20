import { expect } from "chai";
import { CubeCoordinates } from "hexagrid";
import { Planet, Spaceship } from "./enums";
import { GaiaHex } from "./gaia-hex";
import {
  DEEP_SPACE_TILES,
  DEEP_SPACE_TILES_2P,
  deepSpaceTileCount,
  findDeepSpaceNotches,
  findInterspaceHoles,
  interspaceSet,
  isNewLostFleetSector,
  lostFleetSectorCenters,
  REVISED_SECTOR_FACES_TODO,
  sectorHexes,
} from "./lost-fleet-map";

function hex(sector: string): GaiaHex {
  return new GaiaHex(0, 0, { planet: Planet.Terra, sector });
}

// A Space Station hex: an empty space hex (no planet), as `hasPlanet()` returns false for it.
function spaceHex(sector: string): GaiaHex {
  return new GaiaHex(0, 0, { planet: Planet.Empty, sector });
}

function key(c: CubeCoordinates): string {
  return `${c.q}x${c.r}`;
}

describe("Lost Fleet map layout", () => {
  describe("lostFleetSectorCenters", () => {
    it("should have the right sector count per player count", () => {
      expect(lostFleetSectorCenters(2)).to.have.length(7);
      expect(lostFleetSectorCenters(3)).to.have.length(9);
      expect(lostFleetSectorCenters(4)).to.have.length(10);
    });

    it("should produce no overlapping sector hexes at any player count", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const occupied = new Set<string>();
        for (const center of lostFleetSectorCenters(nbPlayers)) {
          for (const h of sectorHexes(center)) {
            expect(occupied.has(key(h)), `overlap at ${key(h)} for ${nbPlayers}p`).to.be.false;
            occupied.add(key(h));
          }
        }
      }
    });

    it("should keep all sector centres at distance 5 from their nearest neighbour (slid-adjacent)", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const centers = lostFleetSectorCenters(nbPlayers);
        for (const c of centers) {
          const nearest = Math.min(
            ...centers.filter((o) => o !== c).map((o) => CubeCoordinates.distance(c, o))
          );
          expect(nearest, `nearest neighbour distance for ${nbPlayers}p`).to.equal(5);
        }
      }
    });
  });

  describe("findInterspaceHoles", () => {
    it("should find exactly the rulebook number of single-hex interior holes", () => {
      expect(findInterspaceHoles(lostFleetSectorCenters(2))).to.have.length(6);
      expect(findInterspaceHoles(lostFleetSectorCenters(3))).to.have.length(8);
      expect(findInterspaceHoles(lostFleetSectorCenters(4))).to.have.length(10);
    });

    it("should never produce interior holes adjacent to each other (no merged middle gaps)", () => {
      // This is the defect the user flagged: 3-hex clusters in the middle. Each Interspace hole must
      // be a genuinely isolated single hex.
      for (const nbPlayers of [2, 3, 4]) {
        const holes = findInterspaceHoles(lostFleetSectorCenters(nbPlayers));
        const holeKeys = new Set(holes.map(key));
        for (const h of holes) {
          const adjacentHole = [
            { q: h.q + 1, r: h.r },
            { q: h.q - 1, r: h.r },
            { q: h.q, r: h.r + 1 },
            { q: h.q, r: h.r - 1 },
            { q: h.q + 1, r: h.r - 1 },
            { q: h.q - 1, r: h.r + 1 },
          ].some((n) => holeKeys.has(`${n.q}x${n.r}`));
          expect(adjacentHole, `interior hole ${key(h)} touches another hole at ${nbPlayers}p`).to.be.false;
        }
      }
    });
  });

  describe("findDeepSpaceNotches", () => {
    it("should find one perimeter notch per Deep Space tile placed", () => {
      expect(findDeepSpaceNotches(lostFleetSectorCenters(2))).to.have.length(deepSpaceTileCount(2));
      expect(findDeepSpaceNotches(lostFleetSectorCenters(3))).to.have.length(deepSpaceTileCount(3));
      expect(findDeepSpaceNotches(lostFleetSectorCenters(4))).to.have.length(deepSpaceTileCount(4));
    });

    it("should produce 3-hex triangle notches", () => {
      for (const nbPlayers of [2, 3, 4]) {
        for (const notch of findDeepSpaceNotches(lostFleetSectorCenters(nbPlayers))) {
          expect(notch, `notch size at ${nbPlayers}p`).to.have.length(3);
          // the three cells are mutually distinct
          expect(new Set(notch.map(key)).size).to.equal(3);
        }
      }
    });

    it("should not overlap the Interspace holes", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const centers = lostFleetSectorCenters(nbPlayers);
        const interspace = new Set(findInterspaceHoles(centers).map(key));
        for (const notch of findDeepSpaceNotches(centers)) {
          for (const cell of notch) {
            expect(interspace.has(key(cell)), `notch cell ${key(cell)} collides with Interspace at ${nbPlayers}p`)
              .to.be.false;
          }
        }
      }
    });
  });

  describe("Deep Space tile data (§H2)", () => {
    it("should have 8 tiles numbered 11-18, each with two 3-hex faces", () => {
      expect(DEEP_SPACE_TILES).to.have.length(8);
      expect(DEEP_SPACE_TILES.map((t) => t.id)).to.deep.equal([11, 12, 13, 14, 15, 16, 17, 18]);
      for (const tile of DEEP_SPACE_TILES) {
        expect(tile.a).to.have.length(3);
        expect(tile.b).to.have.length(3);
      }
    });

    it("should only contain Protoplanet/Asteroid/Transdim/Empty hexes", () => {
      const allowed = new Set([Planet.Protoplanet, Planet.Asteroid, Planet.Transdim, Planet.Empty]);
      for (const tile of DEEP_SPACE_TILES) {
        for (const planet of [...tile.a, ...tile.b]) {
          expect(allowed.has(planet), `unexpected planet ${planet} on tile ${tile.id}`).to.be.true;
        }
      }
    });

    it("should let 2p use only tiles 11-16", () => {
      expect([...DEEP_SPACE_TILES_2P]).to.deep.equal([11, 12, 13, 14, 15, 16]);
    });

    it("should have the asteroid swing on tile 16 that §H5 keys off (0 on side a, 2 on side b)", () => {
      const tile16 = DEEP_SPACE_TILES.find((t) => t.id === 16);
      expect(tile16.a.filter((p) => p === Planet.Asteroid)).to.have.length(0);
      expect(tile16.b.filter((p) => p === Planet.Asteroid)).to.have.length(2);
    });
  });

  describe("Interspace tile sets (§H3)", () => {
    it("should match the confirmed per-player-count composition", () => {
      expect(interspaceSet(2)).to.include({ asteroid: 2, protoplanet: 1, spaceships: 3, blank: 0, total: 6 });
      expect(interspaceSet(3)).to.include({ asteroid: 2, protoplanet: 1, spaceships: 4, blank: 1, total: 8 });
      expect(interspaceSet(4)).to.include({ asteroid: 4, protoplanet: 1, spaceships: 4, blank: 1, total: 10 });
    });

    it("should exclude Rebellion from the 2p spaceship tiles and no ship at 3p/4p", () => {
      expect(interspaceSet(2).excludedShips).to.deep.equal([Spaceship.Rebellion]);
      expect(interspaceSet(3).excludedShips).to.deep.equal([]);
      expect(interspaceSet(4).excludedShips).to.deep.equal([]);
    });

    it("should have totals that match the number of Interspace holes in the layout", () => {
      for (const nbPlayers of [2, 3, 4]) {
        expect(interspaceSet(nbPlayers).total).to.equal(
          findInterspaceHoles(lostFleetSectorCenters(nbPlayers)).length
        );
      }
    });
  });

  describe("§H4 revised sector faces", () => {
    it("should be flagged as not-yet-available for sectors 5/6/7 at 2p/3p", () => {
      expect(REVISED_SECTOR_FACES_TODO.available).to.be.false;
      expect([...REVISED_SECTOR_FACES_TODO.sectorsNeedingRevisedFace]).to.deep.equal(["5", "6", "7"]);
      expect([...REVISED_SECTOR_FACES_TODO.usedAtPlayerCounts]).to.deep.equal([2, 3]);
    });
  });

  describe("isNewLostFleetSector", () => {
    it("should be true for the first hex colonized in a Space sector", () => {
      const a = hex("5A");
      expect(isNewLostFleetSector([a], a)).to.be.true;
    });

    it("should be false for a second hex in the same Space sector", () => {
      const a = hex("5A");
      const b = hex("5A");
      expect(isNewLostFleetSector([a, b], b)).to.be.false;
    });

    it("should treat different Space sectors as distinct", () => {
      const a = hex("5A");
      const b = hex("7B");
      expect(isNewLostFleetSector([a, b], b)).to.be.true;
    });

    it("should treat all 3 hexes of one Deep Space tile as the same sector", () => {
      const a = hex("DS14_0");
      const b = hex("DS14_1");
      expect(isNewLostFleetSector([a, b], b)).to.be.false;
    });

    it("should treat different Deep Space tiles as distinct sectors", () => {
      const a = hex("DS14_0");
      const b = hex("DS9_1");
      expect(isNewLostFleetSector([a, b], b)).to.be.true;
    });

    it("should never count an Interspace tile as a sector", () => {
      const a = hex("IS3");
      const b = hex("IS3");
      expect(isNewLostFleetSector([a], a)).to.be.false;
      expect(isNewLostFleetSector([a, b], b)).to.be.false;
    });

    it("should ignore a Space Station (empty space hex) already in the sector", () => {
      // A Space Station sits on a Planet.Empty hex and does not colonize the sector, so a mine
      // placed on a planet in that same sector still counts as the first colonization.
      const station = spaceHex("5A");
      const mine = hex("5A");
      expect(isNewLostFleetSector([station, mine], mine)).to.be.true;
    });

    it("should still count a colonized planet already in the sector", () => {
      const station = spaceHex("5A");
      const existingMine = hex("5A");
      const newMine = hex("5A");
      expect(isNewLostFleetSector([station, existingMine, newMine], newMine)).to.be.false;
    });
  });
});
