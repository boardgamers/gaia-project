import { expect } from "chai";
import { Expansion, SpaceshipTechTile } from "../enums";
import { spaceshipTechSpec } from "./spaceship-techs";

describe("spaceshipTechSpec", () => {
  it("should have a non-empty effect string for every Lost Fleet Standard Tech tile", () => {
    for (const tile of SpaceshipTechTile.values(Expansion.LostFleet)) {
      expect(spaceshipTechSpec[tile]).to.be.a("string").with.length.greaterThan(0);
    }
  });

  it("should not define entries beyond the 3 Lost Fleet Standard Tech tiles", () => {
    expect(Object.keys(spaceshipTechSpec)).to.have.length(SpaceshipTechTile.values(Expansion.LostFleet).length);
  });
});
