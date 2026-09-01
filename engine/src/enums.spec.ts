import { expect } from "chai";
import Engine from "./engine";
import { AdvTechTile, BoardAction, Expansion, FinalTile, hasExpansion } from "./enums";

describe("Expansion", () => {
  it("hasExpansion tests individual bits", () => {
    expect(hasExpansion(Expansion.LostFleet, Expansion.LostFleet)).to.be.true;
    expect(hasExpansion(Expansion.None, Expansion.LostFleet)).to.be.false;
  });

  it("All is the combination of every expansion bit", () => {
    expect(Expansion.All).to.equal(Expansion.LostFleet);
    expect(hasExpansion(Expansion.All, Expansion.LostFleet)).to.be.true;
  });

  it("engine.expansions reflects the configured option flags", () => {
    const engine = new Engine(["init 2 randomSeed"], {});
    expect(engine.expansions).to.equal(Expansion.None);

    const lostFleetEngine = new Engine(["init 2 randomSeed"], { lostFleet: true });
    expect(lostFleetEngine.expansions).to.equal(Expansion.LostFleet);
  });

  it("AdvTechTile.values(LostFleet) includes the 6 §G2 tiles, AdvTechTile.values(None) does not", () => {
    const lostFleetOnlyTiles = [
      AdvTechTile.AsteroidPass,
      AdvTechTile.Big,
      AdvTechTile.Deep,
      AdvTechTile.DeepPass,
      AdvTechTile.QAction,
      AdvTechTile.Terra,
    ];

    const withLostFleet = AdvTechTile.values(Expansion.LostFleet);
    const withoutExpansion = AdvTechTile.values(Expansion.None);

    for (const tile of lostFleetOnlyTiles) {
      expect(withLostFleet).to.contain(tile);
      expect(withoutExpansion).to.not.contain(tile);
    }
  });

  it("BoardAction.values(LostFleet) excludes qic1-3, replaced by the spaceship boards' own Q.I.C. actions (RULES_CLARIFICATIONS.md §E4/§K3)", () => {
    const qicActions = [BoardAction.Qic1, BoardAction.Qic2, BoardAction.Qic3];

    const withoutExpansion = BoardAction.values(Expansion.None);
    for (const action of qicActions) {
      expect(withoutExpansion).to.contain(action);
    }

    const withLostFleet = BoardAction.values(Expansion.LostFleet);
    for (const action of qicActions) {
      expect(withLostFleet).to.not.contain(action);
    }
    for (let i = 1; i <= 7; i++) {
      expect(withLostFleet).to.contain(BoardAction[`Power${i}`]);
    }
  });
  it("FinalTile.values(LostFleet) includes the 3 Lost Fleet end scorings, FinalTile.values(None) does not", () => {
    const lostFleetOnlyTiles = [
      FinalTile.Asteroid,
      FinalTile.PlanetaryInstituteAcademyDistance,
      FinalTile.DeepSpaceSector,
    ];

    const withLostFleet = FinalTile.values(Expansion.LostFleet);
    const withoutExpansion = FinalTile.values(Expansion.None);

    for (const tile of lostFleetOnlyTiles) {
      expect(withLostFleet).to.contain(tile);
      expect(withoutExpansion).to.not.contain(tile);
    }
  });
});
