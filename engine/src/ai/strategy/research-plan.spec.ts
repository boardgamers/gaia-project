import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { AdvTechTile, AdvTechTilePos, Command, Phase, ResearchField } from "../../enums";
import { expandAtomicDecisions } from "../actions/expand";
import { StrategyPlanMacroBot } from "../bots/strategy-plan";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import {
  assessResearchPlan,
  evaluateResearchPlanTransition,
  rankResearchPlans,
  RESEARCH_PLAN_ID,
  researchPlanApplies,
} from "./research-plan";

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove).faction;
}

function roundThreePlanningEngine(): Engine {
  const engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard).to.be.greaterThan(0);
  }
  engine.round = 3;
  engine.phase = Phase.RoundMove;
  return engine;
}

describe("AI-7 research and Advanced Tech plan", () => {
  it("chooses a setup-aware target from the actual Advanced Tech layout", () => {
    const engine = roundThreePlanningEngine();
    const actor = engine.playerToMove;
    for (const field of ResearchField.values(engine.expansions)) {
      engine.player(actor).data.research[field] = 0;
    }
    engine.tiles.techs[AdvTechTilePos.Intelligence] = { tile: AdvTechTile.AdvTech13, count: 1 };
    const plans = rankResearchPlans(engine, actor);
    expect(plans[0].target).to.equal(ResearchField.Intelligence);
    expect(plans[0].advancedTech).to.equal(AdvTechTile.AdvTech13);
    expect(plans[0].reasons).to.include("advanced-tech:advtech13");
  });

  it("rewards focused track progress and treats its four-knowledge payment as productive", () => {
    const source = roundThreePlanningEngine();
    const actor = source.playerToMove;
    const target = rankResearchPlans(source, actor)[0].target;
    source.player(actor).data.knowledge = 4;
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    destination.player(actor).data.knowledge = 0;
    destination.player(actor).data.research[target] += 1;
    const report = evaluateResearchPlanTransition(source, destination, actor, target, Command.UpgradeResearch, true);
    expect(report.targetProgressDelta).to.equal(1);
    expect(report.reserveViolation).to.equal(0);
    expect(report.score).to.be.greaterThan(0);
  });

  it("reports unrelated knowledge spending that breaks the research reserve", () => {
    const source = roundThreePlanningEngine();
    const actor = source.playerToMove;
    const target = rankResearchPlans(source, actor)[0].target;
    source.player(actor).data.knowledge = 4;
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    destination.player(actor).data.knowledge = 3;
    const report = evaluateResearchPlanTransition(source, destination, actor, target, Command.Spend, true);
    expect(report.targetProgressDelta).to.equal(0);
    expect(report.reserveViolation).to.equal(1);
    expect(report.score).to.be.lessThan(0);
  });

  it("blocks a level-four Advanced Tech goal when no green token or Federation bridge exists", () => {
    const engine = roundThreePlanningEngine();
    const actor = engine.playerToMove;
    engine.player(actor).data.research[ResearchField.Intelligence] = 4;
    engine.player(actor).data.tiles.federations = [];
    engine.player(actor).data.spaceshipFederations = [];
    const blocked = assessResearchPlan(engine, actor, ResearchField.Intelligence, {
      federationActionAvailable: false,
    });
    const bridged = assessResearchPlan(engine, actor, ResearchField.Intelligence, {
      federationActionAvailable: true,
    });
    expect(blocked.federationBridgeAvailable).to.equal(false);
    expect(blocked.advancedTechAccessFactor).to.equal(0);
    expect(blocked.viable).to.equal(false);
    expect(bridged.advancedTechAccessFactor).to.equal(1);
    expect(bridged.viable).to.equal(true);
  });

  it("persists the selected target and exposes every transition term", () => {
    const engine = roundThreePlanningEngine();
    engine.player(engine.playerToMove).data.knowledge = 12;
    const bot = new StrategyPlanMacroBot();
    const first = bot.select(engine);
    const second = bot.select(engine);
    expect(first.evaluation.activePlan).to.equal(RESEARCH_PLAN_ID);
    expect(first.evaluation.researchTarget).to.be.oneOf(ResearchField.values(engine.expansions));
    expect(second.evaluation.researchTarget).to.equal(first.evaluation.researchTarget);
    expect(second.evaluation.planDecision).to.equal(`retained:${RESEARCH_PLAN_ID}:${first.evaluation.researchTarget}`);
    expect(first.evaluation.transition).to.not.equal(null);
    expect(first.macro.mainCommand).to.not.equal(Command.Pass);
    expect(JSON.stringify(first.evaluation.transition)).to.include("reserveViolation");
  });

  it("marks an owned target Advanced Tech complete", () => {
    const engine = roundThreePlanningEngine();
    const actor = engine.playerToMove;
    const target = rankResearchPlans(engine, actor)[0].target;
    const assessment = assessResearchPlan(engine, actor, target);
    expect(assessment.advancedTech).to.not.equal(null);
    engine.player(actor).data.tiles.techs.push({
      tile: assessment.advancedTech,
      pos: `adv-${target}` as AdvTechTilePos,
      enabled: true,
    });
    expect(assessResearchPlan(engine, actor, target).complete).to.equal(true);
  });

  it("continues the retained research path through round six", () => {
    const engine = roundThreePlanningEngine();
    engine.round = 6;
    expect(researchPlanApplies(engine)).to.equal(true);
    engine.player(engine.playerToMove).data.knowledge = 4;
    const selection = new StrategyPlanMacroBot().select(engine);
    expect(selection.evaluation.activePlan).to.equal(RESEARCH_PLAN_ID);
    expect(selection.macro.mainCommand).to.not.equal(Command.Pass);
    expect(selection.evaluation.tempo).to.equal(null);
    engine.round = 7;
    expect(researchPlanApplies(engine)).to.equal(false);
  });
});
