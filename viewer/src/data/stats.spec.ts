import { Building, Expansion, Faction, GaiaHex, Planet, Player, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { deepSpaceSectors, sectors } from "./stats";

function mine(sector: string, q = 0): GaiaHex {
  return new GaiaHex(q, -q, {
    sector,
    planet: sector.startsWith("DS") ? Planet.Protoplanet : Planet.Terra,
    player: PlayerEnum.Player1,
    building: Building.Mine,
  });
}

describe("stats", () => {
  describe("sectors", () => {
    it("does not count a Deep Space Sector tile (owner ruling: only real Space sectors count)", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;

      player.data.occupied.push(
        new GaiaHex(0, 0, { sector: "s1", planet: Planet.Terra, player: PlayerEnum.Player1, building: Building.Mine }),
        new GaiaHex(1, -1, {
          sector: "DS11_0",
          planet: Planet.Protoplanet,
          player: PlayerEnum.Player1,
          building: Building.Mine,
        })
      );

      expect(sectors(player)).to.equal(1);
      expect(deepSpaceSectors(player)).to.equal(1);
    });
  });

  describe("deepSpaceSectors", () => {
    let player: Player;

    beforeEach(() => {
      player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
    });

    it("keeps ordinary sector counts separate from Deep Space counts", () => {
      player.data.occupied.push(mine("s1"), mine("s1", 1), mine("s2", 2));

      expect(sectors(player)).to.equal(2);
      expect(deepSpaceSectors(player)).to.equal(0);

      player.data.occupied.push(mine("DS11_0", 3));

      expect(sectors(player)).to.equal(2);
      expect(deepSpaceSectors(player)).to.equal(1);
    });

    it("counts DSx_0, DSx_1 and DSx_2 as one physical Deep Space tile", () => {
      player.data.occupied.push(...[0, 1, 2].map((index) => mine(`DS11_${index}`, index)));

      expect(deepSpaceSectors(player)).to.equal(1);
      expect(sectors(player)).to.equal(0);
    });

    it("counts distinct Deep Space tiles separately", () => {
      player.data.occupied.push(mine("DS11_0"), mine("DS12_1", 1), mine("DS13_2", 2));

      expect(deepSpaceSectors(player)).to.equal(3);
      expect(sectors(player)).to.equal(0);
    });

    it("does not count Interspace hexes as either kind of sector", () => {
      player.data.occupied.push(mine("IS1"), mine("IS2", 1));

      expect(deepSpaceSectors(player)).to.equal(0);
      expect(sectors(player)).to.equal(0);
    });

    for (const [label, building, planet] of [
      ["Gaiaformers", Building.GaiaFormer, Planet.Transdim],
      ["space stations", Building.SpaceStation, Planet.Empty],
    ] as const) {
      it(`does not count ${label} as colonizing a sector`, () => {
        for (const [index, sector] of ["s1", "DS11_0"].entries()) {
          const hex = mine(sector, index);
          hex.data.building = building;
          hex.data.planet = planet;
          player.data.occupied.push(hex);
        }

        expect(deepSpaceSectors(player)).to.equal(0);
        expect(sectors(player)).to.equal(0);
      });
    }

    it("does not count an opponent's colonies in the occupied list", () => {
      for (const [index, sector] of ["s1", "DS11_0"].entries()) {
        const hex = mine(sector, index);
        hex.data.player = PlayerEnum.Player2;
        player.data.occupied.push(hex);
      }

      expect(deepSpaceSectors(player)).to.equal(0);
      expect(sectors(player)).to.equal(0);
    });

    it("counts Lantids shared mines for the guest, deduplicating Deep Space tiles", () => {
      player.faction = Faction.Lantids;
      for (const [index, sector] of ["s1", "DS11_0", "DS11_1"].entries()) {
        const hex = mine(sector, index);
        hex.data.player = PlayerEnum.Player2;
        hex.data.additionalMine = player.player;
        player.data.occupied.push(hex);
      }

      expect(deepSpaceSectors(player)).to.equal(1);
      expect(sectors(player)).to.equal(1);

      for (const hex of player.data.occupied) {
        delete hex.data.additionalMine;
      }

      expect(deepSpaceSectors(player)).to.equal(0);
      expect(sectors(player)).to.equal(0);
    });

    it("returns zero for a player with no occupied hexes", () => {
      expect(deepSpaceSectors(player)).to.equal(0);
      expect(sectors(player)).to.equal(0);
    });
  });
});
