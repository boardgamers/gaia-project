import { expect } from "chai";
import "mocha";
import { Planet } from "./enums";
import { terraformingStepsRequired } from "./planets";

describe("terraformingStepsRequired", () => {
  it("should require 0 steps for an Asteroid target, regardless of home planet", () => {
    expect(terraformingStepsRequired(Planet.Terra, Planet.Asteroid)).to.equal(0);
    expect(terraformingStepsRequired(Planet.Ice, Planet.Asteroid)).to.equal(0);
  });

  it("should require 3 steps for a Protoplanet target, regardless of home planet", () => {
    expect(terraformingStepsRequired(Planet.Terra, Planet.Protoplanet)).to.equal(3);
    expect(terraformingStepsRequired(Planet.Ice, Planet.Protoplanet)).to.equal(3);
  });
});
