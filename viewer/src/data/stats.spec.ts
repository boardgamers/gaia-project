import { Building, Expansion, Faction, GaiaHex, Planet, Player, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { sectors } from "./stats";

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
    });
  });
});
