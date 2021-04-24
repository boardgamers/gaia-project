import { expect } from "chai";
import Engine from "./engine";
import { Faction, Player as PlayerEnum } from "./enums";
import { oppositeFaction } from "./factions";

describe("Factions", () => {
  it("lantids should be opposite terrans", () => {
    expect(oppositeFaction(Faction.Terrans)).to.equal(Faction.Lantids);
  });

  describe("balanced variant", () => {
    it("gleens should start with one QIC", () => {
      const moves = [
        "init 2 randomSeed",
        "p1 faction lantids",
        "p2 faction gleens",
        "p1 build m -4x2",
        "p2 build m -2x2",
        "p2 build m 1x2",
        "p1 build m -4x-1",
        "p2 booster booster3",
        "p1 booster booster4",
        "p1 pass booster5",
        "p2 pass booster4",
      ];

      const engine = new Engine(moves, { factionVariant: "more-balanced" });
      expect(engine.player(PlayerEnum.Player2).data.qics).to.equal(1);
    });
  });
});
