import { expect } from "chai";
import "mocha";
import { Faction, Planet } from "./enums";
import { terraformingStepsRequired } from "./planets";

describe("terraformingStepsRequired", () => {
  it("should require 0 steps for an Asteroid target, regardless of home planet", () => {
    expect(terraformingStepsRequired(Faction.Terrans, Planet.Asteroid)).to.equal(0);
    expect(terraformingStepsRequired(Faction.Itars, Planet.Asteroid)).to.equal(0);
  });

  it("should require 3 steps for a Protoplanet target, regardless of home planet", () => {
    expect(terraformingStepsRequired(Faction.Terrans, Planet.Protoplanet)).to.equal(3);
    expect(terraformingStepsRequired(Faction.Itars, Planet.Protoplanet)).to.equal(3);
  });

  it("should require a flat 1 step for Darkanians, regardless of target planet color", () => {
    expect(terraformingStepsRequired(Faction.Darkanians, Planet.Ice)).to.equal(1);
    expect(terraformingStepsRequired(Faction.Darkanians, Planet.Terra)).to.equal(1);
    expect(terraformingStepsRequired(Faction.Darkanians, Planet.Volcanic)).to.equal(1);
  });

  it("should require a flat 2 steps for Space Giants, regardless of target planet color", () => {
    expect(terraformingStepsRequired(Faction.SpaceGiants, Planet.Ice)).to.equal(2);
    expect(terraformingStepsRequired(Faction.SpaceGiants, Planet.Terra)).to.equal(2);
    expect(terraformingStepsRequired(Faction.SpaceGiants, Planet.Volcanic)).to.equal(2);
  });

  it("should require 3 steps only for the assigned cost-3 colors for Tinkeroids and Moweyds", () => {
    const cost3 = [Planet.Terra, Planet.Oxide, Planet.Ice];

    expect(terraformingStepsRequired(Faction.Tinkeroids, Planet.Terra, cost3)).to.equal(3);
    expect(terraformingStepsRequired(Faction.Tinkeroids, Planet.Volcanic, cost3)).to.equal(1);
    expect(terraformingStepsRequired(Faction.Moweyds, Planet.Ice, cost3)).to.equal(3);
    expect(terraformingStepsRequired(Faction.Moweyds, Planet.Desert, cost3)).to.equal(1);
  });

  it("should still require 0 steps for Darkanians/Space Giants on Asteroid/Gaia/Transdim", () => {
    expect(terraformingStepsRequired(Faction.Darkanians, Planet.Asteroid)).to.equal(0);
    expect(terraformingStepsRequired(Faction.Darkanians, Planet.Gaia)).to.equal(0);
    expect(terraformingStepsRequired(Faction.SpaceGiants, Planet.Transdim)).to.equal(0);
  });

  it("should still use the global Asteroid/Protoplanet rules for Tinkeroids and Moweyds", () => {
    expect(terraformingStepsRequired(Faction.Tinkeroids, Planet.Asteroid, [Planet.Terra])).to.equal(0);
    expect(terraformingStepsRequired(Faction.Moweyds, Planet.Protoplanet, [Planet.Terra])).to.equal(3);
  });
});
