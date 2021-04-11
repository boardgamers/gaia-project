import { expect } from "chai";
import { Faction } from "./enums";
import { oppositeFaction } from "./factions";

describe("Factions", () => {
  it("lantids should be opposite terrans", () => {
    expect(oppositeFaction(Faction.Terrans)).to.equal(Faction.Lantids);
  });
});
