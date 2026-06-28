import { expect } from "chai";
import { CubeCoordinates } from "hexagrid";
import { Planet, Spaceship } from "./enums";
import { generateLostFleetBoard } from "./lost-fleet-board";
import { classifySectorId, deepSpaceTileCount, interspaceSet, LostFleetSectorType } from "./lost-fleet-map";

function key(c: CubeCoordinates): string {
  return `${c.q}x${c.r}`;
}

function dist(a: CubeCoordinates, b: CubeCoordinates): number {
  return CubeCoordinates.distance(a, b);
}

const SECTOR_COUNT: { [nbPlayers: number]: number } = { 2: 7, 3: 9, 4: 10 };

describe("Lost Fleet board assembly", () => {
  describe("generateLostFleetBoard", () => {
    it("should be deterministic for a given seed", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const a = generateLostFleetBoard(nbPlayers, "same-seed");
        const b = generateLostFleetBoard(nbPlayers, "same-seed");
        expect([...a.grid.values()].map((h) => h.toJSON())).to.deep.equal(
          [...b.grid.values()].map((h) => h.toJSON())
        );
      }
    });

    it("should produce a different layout for a different seed", () => {
      const a = generateLostFleetBoard(4, "seed-one");
      const b = generateLostFleetBoard(4, "seed-two");
      expect([...a.grid.values()].map((h) => h.toJSON())).to.not.deep.equal(
        [...b.grid.values()].map((h) => h.toJSON())
      );
    });

    it("should produce the right total hex count per player count, with no coordinate collisions", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const { grid } = generateLostFleetBoard(nbPlayers, `seed-${nbPlayers}`);
        const hexes = [...grid.values()];
        const keys = hexes.map((h) => key(h));
        expect(new Set(keys).size, `duplicate coordinates at ${nbPlayers}p`).to.equal(keys.length);

        const expectedCount =
          SECTOR_COUNT[nbPlayers] * 19 + interspaceSet(nbPlayers).total + deepSpaceTileCount(nbPlayers) * 3;
        expect(hexes.length, `total hex count at ${nbPlayers}p`).to.equal(expectedCount);
      }
    });

    it("should classify hexes correctly by sector id convention", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const { grid } = generateLostFleetBoard(nbPlayers, `classify-${nbPlayers}`);
        const counts = { [LostFleetSectorType.Space]: 0, [LostFleetSectorType.Interspace]: 0, [LostFleetSectorType.DeepSpace]: 0 };
        for (const hex of grid.values()) {
          counts[classifySectorId(hex.data.sector)]++;
        }
        expect(counts[LostFleetSectorType.Space], `space hex count at ${nbPlayers}p`).to.equal(SECTOR_COUNT[nbPlayers] * 19);
        expect(counts[LostFleetSectorType.Interspace], `interspace hex count at ${nbPlayers}p`).to.equal(
          interspaceSet(nbPlayers).total
        );
        expect(counts[LostFleetSectorType.DeepSpace], `deep space hex count at ${nbPlayers}p`).to.equal(
          deepSpaceTileCount(nbPlayers) * 3
        );
      }
    });

    it("should place exactly the ships in play onto Interspace hexes, each on its own hex", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const { grid } = generateLostFleetBoard(nbPlayers, `ships-${nbPlayers}`);
        const shipHexes = [...grid.values()].filter((h) => h.data.spaceship !== undefined);
        const ships = shipHexes.map((h) => h.data.spaceship);
        expect(new Set(ships).size, `duplicate ships at ${nbPlayers}p`).to.equal(ships.length);
        expect(ships.length, `ship count at ${nbPlayers}p`).to.equal(interspaceSet(nbPlayers).spaceships);
        if (nbPlayers <= 2) {
          expect(ships).to.not.include(Spaceship.Rebellion);
        }
        for (const hex of shipHexes) {
          expect(hex.data.planet, `ship hex planet at ${nbPlayers}p`).to.equal(Planet.Empty);
        }
      }
    });

    it("should keep all spaceship hexes at least MIN_SPACESHIP_DISTANCE apart", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const { grid } = generateLostFleetBoard(nbPlayers, `spacing-${nbPlayers}`);
        const shipHexes = [...grid.values()].filter((h) => h.data.spaceship !== undefined);
        for (let i = 0; i < shipHexes.length; i++) {
          for (let j = i + 1; j < shipHexes.length; j++) {
            expect(
              dist(shipHexes[i], shipHexes[j]),
              `distance between ${shipHexes[i].data.spaceship} and ${shipHexes[j].data.spaceship} at ${nbPlayers}p`
            ).to.be.at.least(4);
          }
        }
      }
    });

    it("should return per-sector placement metadata matching the assembled grid", () => {
      for (const nbPlayers of [2, 3, 4]) {
        const { grid, sectors } = generateLostFleetBoard(nbPlayers, `placement-${nbPlayers}`);
        expect(sectors, `sector count at ${nbPlayers}p`).to.have.length(SECTOR_COUNT[nbPlayers]);

        const names = sectors.map((s) => s.sector);
        expect(new Set(names).size, `duplicate sector names at ${nbPlayers}p`).to.equal(names.length);

        for (const placement of sectors) {
          // Every hex of that sector's 19-hex hexagon should exist in the grid, centered exactly
          // where the placement says, and tagged with this same sector name.
          for (const hex of grid.values()) {
            if (hex.data.sector === placement.sector) {
              expect(dist(hex, placement.center), `${placement.sector} hex within radius 2 of its center`).to.be.at.most(2);
            }
          }
          expect(grid.get(placement.center)?.data.sector, `center hex sector at ${nbPlayers}p`).to.equal(
            placement.sector
          );
        }
      }
    });

    it("should only use Deep Space tiles 11-16 at 2 players", () => {
      const { grid } = generateLostFleetBoard(2, "deep-space-2p");
      for (const hex of grid.values()) {
        if (classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace) {
          const id = Number(hex.data.sector.replace("DS", "").split("_")[0]);
          expect(id, `tile id ${id} should be in 11-16 range at 2p`).to.be.at.most(16);
        }
      }
    });

    it("should report adjacent Deep Space notch pairs only at 3 players", () => {
      expect(generateLostFleetBoard(2, "adj-2p").adjacentNotchPairs).to.have.length(0);
      expect(generateLostFleetBoard(3, "adj-3p").adjacentNotchPairs).to.have.length(1);
      expect(generateLostFleetBoard(4, "adj-4p").adjacentNotchPairs).to.have.length(0);
    });

    it("should never place two hexes of the same planet type next to each other (German rules)", () => {
      for (const nbPlayers of [2, 3, 4]) {
        for (const seed of ["valid-1", "valid-2", "valid-3", "valid-4", "valid-5"]) {
          const { grid } = generateLostFleetBoard(nbPlayers, `${seed}-${nbPlayers}`);
          for (const hex of grid.values()) {
            if (hex.data.planet === Planet.Transdim || hex.data.planet === Planet.Empty || hex.data.planet === Planet.Gaia) {
              continue;
            }
            for (const neighbour of grid.neighbours(hex)) {
              expect(
                neighbour.data.planet,
                `${key(hex)} (${hex.data.planet}) next to ${key(neighbour)} (${neighbour.data.planet}) at ${nbPlayers}p`
              ).to.not.equal(hex.data.planet);
            }
          }
        }
      }
    });
  });
});
