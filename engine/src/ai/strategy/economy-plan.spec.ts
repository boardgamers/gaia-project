import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { Command, Phase, Resource } from "../../enums";
import { expandAtomicDecisions } from "../actions/expand";
import { roundActionBudget, StrategyPlanMacroBot } from "../bots/strategy-plan";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import {
  assessEconomyPlan,
  ECONOMY_PLAN_TRANSITION_WEIGHTS,
  EconomyReserveBundle,
  evaluateEconomyPlanTransition,
} from "./economy-plan";

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove).faction;
}

function roundMoveEngine(): Engine {
  const engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  let guard = 30;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard).to.be.greaterThan(0);
  }
  return engine;
}

function clone(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

const EMPTY: EconomyReserveBundle = { credits: 0, ores: 0, knowledge: 0, qics: 0 };
const KNOWLEDGE_BUNDLE: EconomyReserveBundle = { credits: 0, ores: 0, knowledge: 4, qics: 0 };

describe("AI-7 economy plan", () => {
  it("scores wallet coverage of the needed combination, not raw stock", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    source.player(actor).data.knowledge = 0;

    const covered = clone(source);
    covered.player(actor).data.knowledge = 4; // buys exactly what the plan is short of

    const unrelated = clone(source);
    unrelated.player(actor).data.ores += 3; // piles on a resource the bundle does not need

    const coveredReport = evaluateEconomyPlanTransition(
      source,
      covered,
      actor,
      Command.UpgradeResearch,
      KNOWLEDGE_BUNDLE,
      false
    );
    const unrelatedReport = evaluateEconomyPlanTransition(
      source,
      unrelated,
      actor,
      Command.Build,
      KNOWLEDGE_BUNDLE,
      false
    );

    expect(coveredReport.bundleCoverageDelta).to.be.closeTo(1, 1e-9);
    expect(unrelatedReport.bundleCoverageDelta).to.equal(0);
    expect(coveredReport.score).to.be.greaterThan(unrelatedReport.score);
  });

  it("does not credit coverage for stacking an already-covered resource", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    source.player(actor).data.knowledge = 4; // bundle already fully covered

    const destination = clone(source);
    destination.player(actor).data.knowledge = 10;

    const report = evaluateEconomyPlanTransition(
      source,
      destination,
      actor,
      Command.UpgradeResearch,
      KNOWLEDGE_BUNDLE,
      false
    );
    expect(report.bundleCoverageBefore).to.equal(1);
    expect(report.bundleCoverageDelta).to.equal(0);
  });

  it("detects value wasted past the resource caps under live income", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    // Round-1 challenge position has ore income 3, so a full ore wallet overflows the 15 cap.
    expect(source.player(actor).resourceIncome(Resource.Ore)).to.be.greaterThan(0);
    const atCap = clone(source);
    atCap.player(actor).data.ores = 15;
    const belowCap = clone(source);
    belowCap.player(actor).data.ores = 7;

    expect(assessEconomyPlan(atCap, actor, EMPTY).capWaste).to.be.greaterThan(0);
    expect(assessEconomyPlan(belowCap, actor, EMPTY).capWaste).to.equal(0);

    const spendDown = evaluateEconomyPlanTransition(atCap, belowCap, actor, Command.Build, EMPTY, false);
    expect(spendDown.capWasteReduction).to.be.greaterThan(0);
  });

  it("penalizes spending resources with no durable progress", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    source.player(actor).data.credits = 15;
    const destination = clone(source);
    destination.player(actor).data.credits = 5; // spent, but no building/research/score change

    const report = evaluateEconomyPlanTransition(source, destination, actor, Command.Special, EMPTY, false);
    expect(report.durableProgress).to.equal(false);
    expect(report.wastefulSpend).to.equal(true);
    expect(report.score).to.be.lessThan(0);
  });

  it("does not penalize spending that advances the board", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    const destination = clone(source);
    destination.player(actor).data.victoryPoints += 2; // durable progress despite any payment
    destination.player(actor).data.credits = Math.max(source.player(actor).data.credits - 10, 0);

    const report = evaluateEconomyPlanTransition(source, destination, actor, Command.Build, EMPTY, false);
    expect(report.durableProgress).to.equal(true);
    expect(report.wastefulSpend).to.equal(false);
  });

  it("rewards a resource-preserving Pass only when no productive alternative exists", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    const still = clone(source);

    const onlyWaste = evaluateEconomyPlanTransition(source, still, actor, Command.Pass, EMPTY, false);
    expect(onlyWaste.passPreservesResources).to.equal(true);
    expect(onlyWaste.score).to.equal(ECONOMY_PLAN_TRANSITION_WEIGHTS.passPreserves);

    const productiveExists = evaluateEconomyPlanTransition(source, still, actor, Command.Pass, EMPTY, true);
    expect(productiveExists.passPreservesResources).to.equal(false);
    expect(productiveExists.score).to.equal(0);
  });

  it("scores income compatible with the budget higher than an income-starved need", () => {
    const engine = roundMoveEngine();
    const actor = engine.playerToMove;
    // Round-1 challenge position: ore income is positive, credit income is zero.
    expect(engine.player(actor).resourceIncome(Resource.Credit)).to.equal(0);
    const oreNeed = assessEconomyPlan(engine, actor, { credits: 0, ores: 3, knowledge: 0, qics: 0 });
    const creditNeed = assessEconomyPlan(engine, actor, { credits: 6, ores: 0, knowledge: 0, qics: 0 });
    expect(oreNeed.incomeCoverage).to.be.greaterThan(creditNeed.incomeCoverage);
    expect(creditNeed.incomeCoverage).to.equal(0);
  });

  it("budgets a multi-action round, not just the single next prerequisite", () => {
    const engine = roundMoveEngine();
    const actor = engine.playerToMove;

    expect(roundActionBudget(engine, actor, null, null)).to.deep.equal(EMPTY);

    const mineSpread = roundActionBudget(engine, actor, "mine-spread", null);
    expect(mineSpread.ores).to.be.greaterThan(1); // several mines, not one
    expect(mineSpread.credits).to.be.greaterThan(0);
  });

  it("stays inert by default and only reports when explicitly enabled", () => {
    const engine = roundMoveEngine();
    const frozen = new StrategyPlanMacroBot().select(clone(engine));
    expect(frozen.evaluation.economy).to.equal(null);

    const enabled = new StrategyPlanMacroBot({ economyPlanning: true }).select(clone(engine));
    expect(enabled.evaluation.economy).to.not.equal(null);
  });
});
