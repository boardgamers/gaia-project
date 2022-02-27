import { expect } from "chai";
import { latestVariantVersion } from ".";

describe("Faction boards", () => {
  describe("latestVariantVersion", () => {
    it("shoud equal 2 for 'beta' variant", () => {
      expect(latestVariantVersion("beta")).to.equal(2);
    });

    it("shoud equal 0 for 'standard' variant", () => {
      expect(latestVariantVersion("standard")).to.equal(0);
    });
  });
});
