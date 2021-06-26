import { Faction } from "@gaia-project/engine";
import { expect } from "chai";
import { factionLogTextColors } from "./utils";

describe("factionLogTextColors", () => {
  describe("should be white", () => {
    for (const faction of [
      Faction.Bescods,
      Faction.Darloks,
      Faction.Firaks,
      Faction.Taklons,
      Faction.Ambas,
      Faction.Nevlas,
      Faction.Itars,
    ]) {
      it(faction, () => {
        expect(factionLogTextColors[faction]).to.equal("white");
      });
    }
  });

  describe("should be black", () => {
    for (const faction of [Faction.Gleens, Faction.Xenos]) {
      it(faction, () => {
        expect(factionLogTextColors[faction]).to.equal("black");
      });
    }
  });
});
