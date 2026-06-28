import { expect } from "chai";
import { Expansion, SpaceshipFederation } from "../enums";
import { spaceshipFederationSpec } from "./spaceship-federations";

describe("spaceshipFederationSpec", () => {
  it("should have a non-empty effect string for every Lost Fleet Federation token", () => {
    for (const token of SpaceshipFederation.values(Expansion.LostFleet)) {
      expect(spaceshipFederationSpec[token]).to.be.a("string").with.length.greaterThan(0);
    }
  });

  it("should not define entries beyond the 8 Lost Fleet Federation tokens", () => {
    expect(Object.keys(spaceshipFederationSpec)).to.have.length(
      SpaceshipFederation.values(Expansion.LostFleet).length
    );
  });
});
