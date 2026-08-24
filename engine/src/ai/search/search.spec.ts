import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { Phase } from "../../enums";
import { applyMacroHostStyle } from "../bots/common";
import { GreedyMacroBot, greedyStateValue } from "../bots/greedy";
import { SearchMacroBot } from "../bots/search";
import { canonicalStateHash } from "../canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { buildCuratedSearchPositions, playPairedSearchStrengthMatchup, StrengthOpponent } from "../testing/strength";
import { EngineSearchDomain } from "./engine-domain";

function challengeSetup(): Engine {
  return new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
}

const greedyOpponent: StrengthOpponent = {
  name: "greedy-macro",
  factory: () => new GreedyMacroBot(),
};

describe("Phase 2 committed-macro search integration", function () {
  this.timeout(30 * 60 * 1000);

  it("runs deterministic fixed-budget PUCT over host-style committed macros", () => {
    const engine = challengeSetup();
    const options = {
      simulations: 3,
      mode: "puct" as const,
      seed: "ai-7-puct-integration",
      macroBuildOptions: { conversionIntegration: false, afterConversionIntegration: false },
    };
    const first = new SearchMacroBot(options).select(engine);
    const second = new SearchMacroBot(options).select(engine);
    expect(second.macro.key).to.equal(first.macro.key);
    expect(second.evaluation.diagnostics.deterministic).to.deep.equal(first.evaluation.diagnostics.deterministic);
    expect(first.evaluation.macroBuildOptions).to.deep.equal({
      conversionIntegration: false,
      afterConversionIntegration: false,
      mainCandidateKeys: undefined,
    });
    const diagnostics = first.evaluation.diagnostics.deterministic;
    expect(diagnostics.rootActions.map((edge) => edge.key)).to.deep.equal(
      first.macroSet.macros.map((macro) => macro.key)
    );
    expect(diagnostics.rootActions.reduce((sum, edge) => sum + edge.prior, 0)).to.be.closeTo(1, 1e-9);
    expect(diagnostics.rootActions.reduce((sum, edge) => sum + edge.visitDelta, 0)).to.equal(3);
    expect(first.macroSet.macros.some((macro) => macro.key === first.macro.key)).to.equal(true);
    expect(applyMacroHostStyle(engine, first.macro).newTurn).to.equal(true);
  });

  it("keeps the frozen heuristic prior at greedyMix zero and exposes an inspectable blended prior", () => {
    const engine = challengeSetup();
    const baselineDomain = new EngineSearchDomain();
    const explicitBaselineDomain = new EngineSearchDomain({ prior: { greedyMix: 0 } });
    const blendedDomain = new EngineSearchDomain({ prior: { greedyMix: 0.5 } });
    const leafBlendedDomain = new EngineSearchDomain({ leafGreedyMix: 0.5 });
    const stateKey = canonicalStateHash(engine);
    const baseline = baselineDomain.expand(engine);
    const explicitBaseline = explicitBaselineDomain.expand(engine);
    const blended = blendedDomain.expand(engine);
    const leafBlended = leafBlendedDomain.expand(engine);
    const report = blendedDomain.priorReport(stateKey);

    expect(explicitBaseline.map((candidate) => candidate.prior)).to.deep.equal(
      baseline.map((candidate) => candidate.prior)
    );
    expect(baselineDomain.priorReport(stateKey).policy).to.equal("heuristic-softmax-uniform-mix");
    expect(baselineDomain.priorReport(stateKey).greedyMix).to.equal(0);
    expect(report.policy).to.equal("heuristic-greedy-softmax-uniform-mix");
    expect(report.greedyMix).to.equal(0.5);
    expect(leafBlendedDomain.priorReport(stateKey).leafGreedyMix).to.equal(0.5);
    expect(leafBlended.map((candidate) => candidate.prior)).to.deep.equal(baseline.map((candidate) => candidate.prior));
    for (const [index, entry] of leafBlendedDomain.priorReport(stateKey).entries.entries()) {
      expect(entry.fixedFrameValue).to.be.closeTo(
        (entry.heuristicFixedFrameValue + entry.greedyFixedFrameValue) / 2,
        1e-12
      );
      expect(leafBlended[index].value).to.equal(entry.fixedFrameValue);
    }
    expect(report.entries.reduce((sum, entry) => sum + entry.heuristicProbability, 0)).to.be.closeTo(1, 1e-9);
    expect(report.entries.reduce((sum, entry) => sum + entry.greedyProbability, 0)).to.be.closeTo(1, 1e-9);
    expect(blended.reduce((sum, candidate) => sum + candidate.prior, 0)).to.be.closeTo(1, 1e-9);
    for (const entry of report.entries) {
      const expected =
        (1 - report.uniformMix) *
          ((1 - report.greedyMix) * entry.heuristicProbability + report.greedyMix * entry.greedyProbability) +
        report.uniformMix / report.entries.length;
      expect(entry.prior).to.be.closeTo(expected, 1e-12);
    }
    expect(() => new EngineSearchDomain({ prior: { greedyMix: -0.01 } })).to.throw(
      "Non-neural prior greedyMix must be between 0 and 1"
    );
    expect(() => new EngineSearchDomain({ leafGreedyMix: 1.01 })).to.throw(
      "Search leafGreedyMix must be between 0 and 1"
    );
  });

  it("keeps immediate greedy frozen and exposes income-normalized search values independently", () => {
    const position = buildCuratedSearchPositions().find((entry) => entry.label === "round-1");
    const immediate = new EngineSearchDomain({ leafGreedyMix: 1, prior: { greedyMix: 1 } });
    const normalized = new EngineSearchDomain({
      leafGreedyMix: 1,
      greedyValueMode: "income-normalized",
      prior: { greedyMix: 1 },
    });
    const immediateCandidates = immediate.expand(position.engine);
    const normalizedCandidates = normalized.expand(position.engine);

    expect(immediate.greedyValueMode).to.equal("immediate");
    expect(normalized.greedyValueMode).to.equal("income-normalized");
    expect(immediateCandidates.map((candidate) => candidate.value)).to.not.deep.equal(
      normalizedCandidates.map((candidate) => candidate.value)
    );
    expect(greedyStateValue(position.engine)).to.not.equal(greedyStateValue(position.engine, "income-normalized"));
  });

  it("applies an actor-relative opportunity cost only to non-terminal Pass values", () => {
    const position = buildCuratedSearchPositions().find((entry) => entry.label === "round-1");
    const baseline = new EngineSearchDomain({ leafGreedyMix: 1, prior: { greedyMix: 1 } });
    const productive = new EngineSearchDomain({
      leafGreedyMix: 1,
      prior: { greedyMix: 1 },
      nonTerminalPassValuePenalty: 4,
    });
    baseline.expand(position.engine);
    productive.expand(position.engine);
    const baselineReport = baseline.priorReport(position.stateHash);
    const productiveReport = productive.priorReport(position.stateHash);
    const macros = baseline.macroSet(position.stateHash);
    const passKey = macros.macros.find((macro) => macro.mainCommand === "pass").key;
    const ordinaryKey = macros.macros.find((macro) => macro.mainCommand !== "pass").key;
    const baselinePass = baselineReport.entries.find((entry) => entry.macroKey === passKey);
    const productivePass = productiveReport.entries.find((entry) => entry.macroKey === passKey);
    const baselineOrdinary = baselineReport.entries.find((entry) => entry.macroKey === ordinaryKey);
    const productiveOrdinary = productiveReport.entries.find((entry) => entry.macroKey === ordinaryKey);

    expect(baselineReport.nonTerminalPassValuePenalty).to.equal(0);
    expect(productiveReport.nonTerminalPassValuePenalty).to.equal(4);
    expect(productivePass.greedyFixedFrameValue).to.equal(baselinePass.greedyFixedFrameValue - 4);
    expect(productiveOrdinary.greedyFixedFrameValue).to.equal(baselineOrdinary.greedyFixedFrameValue);
    expect(() => new EngineSearchDomain({ nonTerminalPassValuePenalty: -1 })).to.throw(
      "Search nonTerminalPassValuePenalty must be finite and non-negative"
    );
  });

  it("keeps the seeded Gumbel root variant reproducible and independently reported", () => {
    const engine = challengeSetup();
    const options = {
      simulations: 5,
      mode: "gumbel-sequential-halving" as const,
      seed: "ai-7-gumbel-integration",
      gumbelMaxActions: 5,
    };
    const first = new SearchMacroBot(options).select(engine);
    const second = new SearchMacroBot(options).select(engine);
    expect(second.macro.key).to.equal(first.macro.key);
    expect(second.evaluation.diagnostics.deterministic).to.deep.equal(first.evaluation.diagnostics.deterministic);
    const diagnostics = first.evaluation.diagnostics.deterministic;
    expect(diagnostics.mode).to.equal("gumbel-sequential-halving");
    expect(diagnostics.completedSimulations).to.equal(5);
    expect(diagnostics.rootActions.reduce((sum, edge) => sum + edge.sequentialHalvingVisits, 0)).to.equal(5);
  });

  it("reuses the actual selected subtree and matches a fresh next-state decision", () => {
    const source = challengeSetup();
    const retained = new SearchMacroBot({ simulations: 1, seed: "ai-7-reuse" });
    const first = retained.select(source);
    const destination = applyMacroHostStyle(source, first.macro);
    const reused = retained.select(destination);
    const fresh = new SearchMacroBot({ simulations: 1, seed: "ai-7-reuse" }).select(destination);
    expect(reused.evaluation.diagnostics.deterministic.reuse.kind).to.equal("same-root");
    expect(reused.evaluation.diagnostics.deterministic.reuse.reusedVisits).to.be.greaterThan(0);
    expect(reused.macro.key).to.equal(fresh.macro.key);
    expect(reused.macroSet.macros.map((macro) => macro.key)).to.deep.equal(
      fresh.macroSet.macros.map((macro) => macro.key)
    );
  });

  it("reports scale-aware PUCT and clears promoted-root moments when configured", () => {
    const source = challengeSetup();
    const retained = new SearchMacroBot({
      simulations: 1,
      seed: "ai-7-scaled-reset-reuse",
      puctValueScale: 32,
      rootReuseVisitPolicy: "reset-subtree",
    });
    const first = retained.select(source);
    const destination = applyMacroHostStyle(source, first.macro);
    const reused = retained.select(destination);
    const diagnostics = reused.evaluation.diagnostics.deterministic;
    expect(diagnostics.puctValueScale).to.equal(32);
    expect(diagnostics.rootReuseVisitPolicy).to.equal("reset-subtree");
    expect(diagnostics.reuse.kind).to.equal("same-root");
    expect(diagnostics.reuse.availableVisits).to.be.greaterThan(0);
    expect(diagnostics.reuse.reusedVisits).to.equal(0);
    expect(diagnostics.completedSimulations).to.equal(1);
  });

  it("guards canonical state, legal macro, and heuristic value parity before DAG reuse", () => {
    const engine = challengeSetup();
    const clone = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    const domain = new EngineSearchDomain();
    expect(canonicalStateHash(clone)).to.equal(canonicalStateHash(engine));
    expect(() => domain.assertTranspositionParity(engine, clone)).not.to.throw();
  });

  it("curates committed setup and round 1-6 positions without command gaps", () => {
    const positions = buildCuratedSearchPositions();
    expect(positions.map((position) => position.label)).to.deep.equal([
      "setup",
      "round-1",
      "round-2",
      "round-3",
      "round-4",
      "round-5",
      "round-6",
    ]);
    expect(new Set(positions.map((position) => position.stateHash)).size).to.equal(7);
    for (const position of positions) {
      expect(position.engine.newTurn).to.equal(true);
      expect(position.actor).to.equal(position.engine.playerToMove);
    }
  });

  it("takes both factions to EndGame at a tiny paired smoke budget", () => {
    const paired = playPairedSearchStrengthMatchup(
      (_seat, seed) => new SearchMacroBot({ simulations: 1, seed }),
      greedyOpponent,
      "ai-7-smoke"
    );
    expect(paired.candidateAsXenos.finalEngine.phase).to.equal(Phase.EndGame);
    expect(paired.candidateAsHadschHallas.finalEngine.phase).to.equal(Phase.EndGame);
    expect(paired.candidateAsXenos.telemetry.selections).to.be.greaterThan(0);
    expect(paired.candidateAsHadschHallas.telemetry.selections).to.be.greaterThan(0);
    expect(paired.telemetry.simulations).to.equal(paired.telemetry.selections);
    expect(paired.candidateAsXenos.finalFixedFrameMargin).to.equal(
      paired.candidateAsXenos.finalSeat0Score - paired.candidateAsXenos.finalSeat1Score
    );
    expect(paired.candidateAsHadschHallas.finalFixedFrameMargin).to.equal(
      paired.candidateAsHadschHallas.finalSeat0Score - paired.candidateAsHadschHallas.finalSeat1Score
    );
    for (const game of [paired.candidateAsXenos, paired.candidateAsHadschHallas]) {
      expect(game.fullGameReport.players.map((player) => player.score.finalScore)).to.deep.equal([
        game.finalSeat0Score,
        game.finalSeat1Score,
      ]);
      expect(game.fullGameReport.players.every((player) => player.totalPasses === 6)).to.equal(true);
    }
  });
});
