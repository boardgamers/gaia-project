import { Expansion, ResearchField } from "@gaia-project/engine";
import { expect } from "chai";
import { descriptions } from "./research";

describe("Research descriptions", () => {
  it("should have descriptions for each research tile", () => {
    const researchFields = ResearchField.values(Expansion.All);

    expect(researchFields.every((field) => field in descriptions)).to.be.true;
    expect(researchFields.every((field) => descriptions[field].length === 6)).to.be.true;
  });
});
