import Engine, { classifySectorId, LostFleetSectorType } from "@gaia-project/engine";
import { lostFleetSectorKey } from "@gaia-project/engine/src/lost-fleet-map";
import { expect } from "chai";
import { displayedHexCenter, hexCenter } from "./hex";

for (const players of [2, 3, 4]) {
  describe(`${players}p Deep Space visual clearance`, () => {
    it("widens every regular-sector boundary with a tiny rigid tile translation, leaving other positions intact", () => {
      const engine = new Engine([`init ${players} deep-space-clearance`], { lostFleet: true });
      const grid = engine.map.grid;
      const coordinates = [...grid.values()].map((hex) => hex.toString());
      const tiles = new Map<string, { x: number; y: number }[]>();
      let boundaries = 0;
      for (const hex of grid.values()) {
        const before = displayedHexCenter(hex);
        const after = displayedHexCenter(hex, grid);
        if (classifySectorId(hex.data.sector) !== LostFleetSectorType.DeepSpace) {
          expect(after).to.deep.equal(before);
          continue;
        }
        const delta = { x: after.x - before.x, y: after.y - before.y };
        expect(Math.hypot(delta.x, delta.y)).to.be.closeTo(0.035, 1e-12);
        const key = lostFleetSectorKey(hex);
        if (!tiles.has(key)) tiles.set(key, []);
        tiles.get(key).push(delta);
        for (const neighbour of grid.neighbours(hex)) {
          if (classifySectorId(neighbour.data.sector) !== LostFleetSectorType.Space) continue;
          // Project onto the shared edge's normal: this measures edge clearance, not
          // just center distance (which could increase while sliding along the edge).
          const a = hexCenter(hex);
          const b = hexCenter(neighbour);
          expect(delta.x * (a.x - b.x) + delta.y * (a.y - b.y)).to.be.at.least(-1e-12);
          const other = displayedHexCenter(neighbour, grid);
          expect(Math.hypot(after.x - other.x, after.y - other.y)).to.be.greaterThan(
            Math.hypot(before.x - other.x, before.y - other.y)
          );
          boundaries++;
        }
      }
      expect([...grid.values()].map((hex) => hex.toString())).to.deep.equal(coordinates);
      expect(boundaries).to.be.greaterThan(0);
      for (const shifts of tiles.values()) {
        expect(shifts).to.have.length(3);
        for (const shift of shifts) {
          expect(shift.x).to.be.closeTo(shifts[0].x, 1e-12);
          expect(shift.y).to.be.closeTo(shifts[0].y, 1e-12);
        }
      }
    });
  });
}
