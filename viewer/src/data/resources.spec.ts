import { Resource, Reward } from "@gaia-project/engine";
import { expect } from "chai";
import { splitCostBonus } from "./resources";

describe("splitCostBonus", () => {
  it("pulls a negative-count VP reward out of a cost as a positive bonus", () => {
    const { cost, bonus } = splitCostBonus(Reward.parse("2c,10o,-6vp"));

    expect(cost.map((r) => r.toString())).to.deep.equal(["2c", "10o"]);
    expect(bonus).to.have.length(1);
    expect(bonus[0].type).to.equal(Resource.VictoryPoint);
    expect(bonus[0].count).to.equal(6);
  });

  it("leaves a cost with no VP bonus untouched", () => {
    const { cost, bonus } = splitCostBonus(Reward.parse("2c,o"));

    expect(cost.map((r) => r.toString())).to.deep.equal(["2c", "o"]);
    expect(bonus).to.have.length(0);
  });

  it("does not touch a genuinely positive VP cost (a real cost, not a bonus)", () => {
    const { cost, bonus } = splitCostBonus(Reward.parse("2c,3vp"));

    expect(cost.map((r) => r.toString())).to.deep.equal(["2c", "3vp"]);
    expect(bonus).to.have.length(0);
  });
});
