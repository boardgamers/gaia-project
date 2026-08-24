import { expect } from "chai";
import "mocha";
import { STRATEGY_PRINCIPLES, STRATEGY_SOURCES, strategyCoverageReport } from "./knowledge";

describe("AI-7 strategy knowledge traceability", () => {
  it("gives every source and normalized principle a stable unique id", () => {
    expect(new Set(STRATEGY_SOURCES.map((source) => source.id)).size).to.equal(STRATEGY_SOURCES.length);
    expect(new Set(STRATEGY_PRINCIPLES.map((principle) => principle.id)).size).to.equal(STRATEGY_PRINCIPLES.length);
  });

  it("maps every retained principle to known sources and at least one inspectable AI disposition", () => {
    const sourceIds = new Set(STRATEGY_SOURCES.map((source) => source.id));
    for (const principle of STRATEGY_PRINCIPLES) {
      expect(principle.statement.trim(), principle.id).to.not.equal("");
      expect(principle.sourceIds.length, principle.id).to.be.greaterThan(0);
      expect(principle.applications.length, principle.id).to.be.greaterThan(0);
      for (const sourceId of principle.sourceIds) {
        expect(sourceIds.has(sourceId), `${principle.id} -> ${sourceId}`).to.equal(true);
      }
      for (const application of principle.applications) {
        expect(application.target.trim(), `${principle.id} -> ${application.kind}`).to.not.equal("");
      }
    }
  });

  it("keeps contested or rejected advice out of unconditional policy", () => {
    for (const principle of STRATEGY_PRINCIPLES.filter((entry) => entry.confidence === "contested")) {
      expect(
        principle.applications.some(
          (application) => application.kind === "documented-hypothesis" || application.kind === "rejected-universal"
        ),
        principle.id
      ).to.equal(true);
    }
    expect(
      STRATEGY_PRINCIPLES.filter((principle) =>
        principle.applications.some((application) => application.kind === "rejected-universal")
      ).map((principle) => principle.id)
    ).to.include.members([
      "opening-academy-strong-contextual",
      "economy-spend-productively",
      "research-focused-but-adaptive",
      "technology-enables-plan",
      "advanced-tech-remaining-uses",
      "lost-fleet-ship-context",
      "faction-identity-modifies-plans",
    ]);
  });

  it("reports source, confidence, and application coverage without losing hypotheses", () => {
    const report = strategyCoverageReport();
    expect(report.sourceCount).to.equal(STRATEGY_SOURCES.length);
    expect(report.principleCount).to.equal(STRATEGY_PRINCIPLES.length);
    expect(report.byApplication["active-plan"]).to.be.greaterThan(0);
    expect(report.byApplication["active-feature"]).to.be.greaterThan(0);
    expect(report.byApplication["documented-hypothesis"]).to.be.greaterThan(0);
    expect(report.byApplication["rejected-universal"]).to.be.greaterThan(0);
  });
});
