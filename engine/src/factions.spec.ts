import { expect } from "chai";
import { Faction } from "./enums";
import factions from "./factions";

describe("Factions", () => {
  it("lantids should be opposite terrans", () => {
    expect(factions.opposite(Faction.Terrans)).to.equal(Faction.Lantids);
  });
});
