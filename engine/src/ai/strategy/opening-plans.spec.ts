import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { Building, Command, Phase } from "../../enums";
import { expandAtomicDecisions } from "../actions/expand";
import { applyMacroHostStyle } from "../bots/common";
import { GreedyMacroBot } from "../bots/greedy";
import { StrategyPlanMacroBot } from "../bots/strategy-plan";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { assessOpeningPlan, evaluateOpeningPlanTransition, OPENING_PLAN_IDS, rankOpeningPlans } from "./opening-plans";

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove).faction;
}

function lockedRoundOneEngine(): Engine {
  const engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard).to.be.greaterThan(0);
  }
  return engine;
}

describe("AI-7 opening strategy plans", () => {
  it("compares the three general opening archetypes without coordinates or move scripts", () => {
    const engine = lockedRoundOneEngine();
    const plans = rankOpeningPlans(engine, engine.playerToMove);
    expect(plans.map((plan) => plan.id).sort()).to.deep.equal([...OPENING_PLAN_IDS].sort());
    for (const plan of plans) {
      expect(plan.priority).to.be.a("number");
      expect(plan.reasons).to.not.be.empty;
      expect(plan.reasons.some((reason) => reason.startsWith("reserve-affordability:"))).to.equal(true);
      expect(JSON.stringify(plan)).to.not.match(/\dA\d/);
    }
  });

  it("rewards prerequisite progress and does not misclassify its resource spend as a reserve violation", () => {
    const source = lockedRoundOneEngine();
    const actor = source.playerToMove;
    const before = assessOpeningPlan(source, actor, "academy-engine");
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    destination.player(actor).data.buildings[Building.Mine] -= 1;
    destination.player(actor).data.buildings[Building.TradingStation] += 1;
    const report = evaluateOpeningPlanTransition(source, destination, actor, "academy-engine", Command.Build, true);
    expect(before.stage).to.equal("mine-to-trading-station");
    expect(report.progressDelta).to.be.greaterThan(0);
    expect(report.reserveViolation).to.equal(0);
    expect(report.score).to.be.greaterThan(0);
  });

  it("reports unrelated spending that damages the next prerequisite reserve", () => {
    const source = lockedRoundOneEngine();
    const actor = source.playerToMove;
    const plan = assessOpeningPlan(source, actor, "academy-engine");
    source.player(actor).data.credits = plan.reserve.credits;
    source.player(actor).data.ores = plan.reserve.ores;
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    destination.player(actor).data.ores = Math.max(destination.player(actor).data.ores - 1, 0);
    const report = evaluateOpeningPlanTransition(source, destination, actor, "academy-engine", Command.Research, true);
    expect(report.progressDelta).to.equal(0);
    expect(report.reserveViolation).to.be.greaterThan(0);
    expect(report.score).to.be.lessThan(0);
  });

  it("selects deterministically, exposes the active plan, and avoids Pass when plan progress exists", () => {
    const engine = lockedRoundOneEngine();
    const firstBot = new StrategyPlanMacroBot();
    const first = firstBot.select(engine);
    const second = new StrategyPlanMacroBot().select(engine);
    expect(second.macro.key).to.equal(first.macro.key);
    expect(first.evaluation.activePlan).to.be.oneOf([...OPENING_PLAN_IDS]);
    expect(first.evaluation.planDecision).to.match(/^selected:/);
    expect(first.evaluation.transition).to.not.equal(null);
    expect(first.macro.mainCommand).to.not.equal(Command.Pass);
    expect(first.evaluation.transition.progressDelta + first.evaluation.transition.reserveGain).to.be.greaterThan(0);
  });

  it("retains a viable plan across the opponent response instead of oscillating", () => {
    const bot = new StrategyPlanMacroBot();
    let engine = lockedRoundOneEngine();
    const actor = engine.playerToMove;
    const first = bot.select(engine);
    engine = applyMacroHostStyle(engine, first.macro);
    let guard = 10;
    while ((engine.playerToMove !== actor || engine.phase !== Phase.RoundMove) && !engine.ended) {
      engine = applyMacroHostStyle(engine, new GreedyMacroBot().select(engine).macro);
      expect(--guard).to.be.greaterThan(0);
    }
    const second = bot.select(engine);
    expect(second.evaluation.activePlan).to.equal(first.evaluation.activePlan);
    expect(second.evaluation.planDecision).to.equal(`retained:${first.evaluation.activePlan}`);
  });
});
