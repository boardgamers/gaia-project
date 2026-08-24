import { expect } from "chai";
import { Planet } from "./enums";
import { GaiaHex } from "./gaia-hex";
import Sector from "./sector";

describe("GaiaHex addressing", () => {
  describe("sectorCenter-stamped hexes (created via Sector.create)", () => {
    it("should produce the same suffix as the legacy lattice-reduction for an unshifted sector", () => {
      const grid = Sector.create("eeeeeeeeeeeeeeeeeee", "5B", { q: 0, r: 0, s: 0 });
      const hex = grid.get({ q: 0, r: 0 });
      expect(hex.toString()).to.equal("5C");
    });

    it("should produce a correct address for a sector centered away from the origin", () => {
      const center = { q: 5, r: -2, s: -3 };
      const grid = Sector.create("eeeeeeeeeeeeeeeeeee", "3", center);
      expect(grid.get(center).toString()).to.equal("3C");
      expect(grid.get({ q: center.q + 2, r: center.r }).toString()).to.equal("3A0");
    });

    it("should keep producing the right address after rotation, since center never moves", () => {
      const center = { q: 5, r: -2, s: -3 };
      const grid = Sector.create("eeeeeeeeeeeeeeeeeee", "3", center).rotateRight(2, center);
      expect(grid.get(center).toString()).to.equal("3C");
    });
  });

  describe("hexes without a sectorCenter (legacy / direct construction)", () => {
    it("should fall back to the lattice-reduction guess and not throw", () => {
      const hex = new GaiaHex(0, 0, { sector: "1", planet: Planet.Empty });
      expect(hex.toString()).to.equal("1C");
    });
  });

  describe("non-Space sector ids (Interspace / Deep Space)", () => {
    it("should return the raw sector id directly for an Interspace hex", () => {
      const hex = new GaiaHex(3, 4, { sector: "IS2", planet: Planet.Empty });
      expect(hex.toString()).to.equal("IS2");
    });

    it("should return the raw sector id directly for a Deep Space hex", () => {
      const hex = new GaiaHex(7, 1, { sector: "DS14_0", planet: Planet.Asteroid });
      expect(hex.toString()).to.equal("DS14_0");
    });

    it("should not throw even though these hexes don't sit on a 19-hex sector hexagon", () => {
      const hex = new GaiaHex(100, 100, { sector: "DS18_2", planet: Planet.Empty });
      expect(() => hex.toString()).to.not.throw();
    });
  });
});
