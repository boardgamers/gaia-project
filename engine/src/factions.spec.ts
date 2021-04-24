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

    it("ivits should keep their starting QIC in a 4p game", () => {
      const moves = [
        "init 4 fast-turn-based-game-EU",
        "p4 rotate -5x2 1 0x0 1 -2x-3 1 -3x5 3 2x3 3",
        "p1 faction firaks",
        "p2 faction gleens",
        "p3 faction ivits",
        "p4 faction itars",
        "firaks build m 4A4",
        "gleens build m 10B1",
        "itars build m 8B3",
        "itars build m 4A1",
        "gleens build m 3A4",
        "firaks build m 7A0",
        "ivits build PI 4B2",
      ];

      const engine = new Engine(moves, { factionVariant: "more-balanced", advancedRules: true });
      expect(engine.player(PlayerEnum.Player3).data.qics).to.equal(1);
    });

    it("ivits should lose their starting QIC in a 2p game", () => {
      const moves = [
        "init 2 randomSeed",
        "p1 faction ivits",
        "p2 faction terrans",
        "p2 build m -1x2",
        "p1 build PI -2x-4",
        "p2 build m -4x2",
      ];

      const engine = new Engine(moves, { factionVariant: "more-balanced" });
      expect(engine.player(PlayerEnum.Player1).data.qics).to.equal(0);
    });
  });
});
