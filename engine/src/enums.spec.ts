import { expect } from "chai";
import Engine from "./engine";
import { Building, Expansion, hasExpansion } from "./enums";

describe("Expansion", () => {
  it("hasExpansion tests individual bits", () => {
    expect(hasExpansion(Expansion.Frontiers, Expansion.Frontiers)).to.be.true;
    expect(hasExpansion(Expansion.Frontiers, Expansion.LostFleet)).to.be.false;
    expect(hasExpansion(Expansion.LostFleet, Expansion.LostFleet)).to.be.true;
    expect(hasExpansion(Expansion.None, Expansion.Frontiers)).to.be.false;
  });

  it("All is the combination of every expansion bit", () => {
    expect(Expansion.All).to.equal(Expansion.Frontiers | Expansion.LostFleet);
    expect(hasExpansion(Expansion.All, Expansion.Frontiers)).to.be.true;
    expect(hasExpansion(Expansion.All, Expansion.LostFleet)).to.be.true;
  });

  it("Building.values(All) still includes Frontiers-only content", () => {
    expect(Building.values(Expansion.All)).to.contain(Building.ColonyShip);
    expect(Building.values(Expansion.All)).to.contain(Building.Colony);
    expect(Building.values(Expansion.None)).to.not.contain(Building.ColonyShip);
  });

  it("engine.expansions reflects the configured option flags", () => {
    const engine = new Engine(["init 2 randomSeed"], {});
    expect(engine.expansions).to.equal(Expansion.None);

    const frontiersEngine = new Engine(["init 2 randomSeed"], { frontiers: true });
    expect(frontiersEngine.expansions).to.equal(Expansion.Frontiers);

    const lostFleetEngine = new Engine(["init 2 randomSeed"], { lostFleet: true });
    expect(lostFleetEngine.expansions).to.equal(Expansion.LostFleet);
  });

  it("Frontiers and Lost Fleet can not be combined", () => {
    expect(() => new Engine(["init 2 randomSeed"], { frontiers: true, lostFleet: true })).to.throw();
  });
});
