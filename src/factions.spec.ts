import {expect} from "chai";
import factions from "./factions";
import { Faction } from "./enums";

describe("Factions", () => {
  it ("lantids should be opposite terrans", () => {
    expect(factions.opposite(Faction.Terrans)).to.equal(Faction.Lantids);
  });
});
