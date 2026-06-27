import { expect } from "chai";
import { factionBoard } from ".";
import { Building, Faction, Resource } from "../enums";

describe("Space Giants", () => {
  const board = factionBoard(Faction.SpaceGiants);
  const defaults = factionBoard(Faction.Terrans); // Terrans has no building-cost overrides

  it("should have power Area I = 4 and Area II = 4", () => {
    expect(board.power).to.deep.equal({ area1: 4, area2: 4 });
  });

  it("should use standard (non-discounted) building costs, including for the Planetary Institute", () => {
    for (const building of [
      Building.Mine,
      Building.TradingStation,
      Building.ResearchLab,
      Building.Academy1,
      Building.Academy2,
      Building.PlanetaryInstitute,
    ]) {
      expect(board.cost(building, false)).to.deep.equal(defaults.cost(building, false));
    }
  });

  it("should grant a free Navigation research step on game start", () => {
    const setupRewards = board.income[0].rewards;

    // tslint:disable-next-line no-unused-expression
    expect(setupRewards.some((r) => r.type === Resource.UpgradeNavigation)).to.be.true;
  });

  it("should grant +1 ore and +1 knowledge as recurring income", () => {
    const recurringRewards = board.income[1].rewards;

    // tslint:disable-next-line no-unused-expression
    expect(recurringRewards.some((r) => r.type === Resource.Ore && r.count === 1)).to.be.true;
    // tslint:disable-next-line no-unused-expression
    expect(recurringRewards.some((r) => r.type === Resource.Knowledge && r.count === 1)).to.be.true;
  });

  it("should grant +6 power charge instead of the standard +4 when building the Planetary Institute", () => {
    const piRewards = board.buildings[Building.PlanetaryInstitute].income[0].flatMap((event) => event.rewards);

    // tslint:disable-next-line no-unused-expression
    expect(piRewards.some((r) => r.type === Resource.ChargePower && r.count === 6)).to.be.true;
  });

  it("should grant an immediate tech tile of choice when building the Planetary Institute", () => {
    const piRewards = board.buildings[Building.PlanetaryInstitute].income[0].flatMap((event) => event.rewards);

    // tslint:disable-next-line no-unused-expression
    expect(piRewards.some((r) => r.type === Resource.TechTile && r.count === 1)).to.be.true;
  });
});
