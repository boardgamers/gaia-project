import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { Command, Phase, ResearchField } from "../../enums";
import { expandAtomicDecisions } from "../actions/expand";
import { StrategyPlanMacroBot } from "../bots/strategy-plan";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { evaluateStrategyTempoTransition } from "./tempo";

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove).faction;
}

function roundMoveEngine(): Engine {
  const engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard).to.be.greaterThan(0);
  }
  return engine;
}

describe("AI-7 strategy tempo", () => {
  it("recognizes durable research progress despite its resource payment", () => {
    const source = roundMoveEngine();
    const actor = source.playerToMove;
    source.player(actor).data.knowledge = 4;
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    destination.player(actor).data.knowledge = 0;
    destination.player(actor).data.research[ResearchField.Intelligence] += 1;
    const report = evaluateStrategyTempoTransition(source, destination, actor, Command.UpgradeResearch, false);
    expect(report.researchDelta).to.equal(1);
    expect(report.productive).to.equal(true);
  });

  it("does not mistake an unchanged action or Pass for productivity", () => {
    const source = roundMoveEngine();
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    const unchanged = evaluateStrategyTempoTransition(source, destination, source.playerToMove, Command.Special, false);
    const pass = evaluateStrategyTempoTransition(source, destination, source.playerToMove, Command.Pass, false);
    expect(unchanged.productive).to.equal(false);
    expect(pass.productive).to.equal(false);
    expect(pass.passPenalty).to.equal(0);
  });

  it("penalizes Pass only when another candidate made measurable progress", () => {
    const source = roundMoveEngine();
    const destination = Engine.fromData(JSON.parse(JSON.stringify(source)));
    const report = evaluateStrategyTempoTransition(source, destination, source.playerToMove, Command.Pass, true, 4);
    expect(report.passPenalty).to.equal(4);
    expect(report.score).to.equal(-4);
  });

  it("keeps a round-six research action ahead of immediate Pass", () => {
    const engine = roundMoveEngine();
    engine.round = 6;
    engine.phase = Phase.RoundMove;
    engine.player(engine.playerToMove).data.knowledge = 4;
    const selection = new StrategyPlanMacroBot({ productivePassPenalty: 4 }).select(engine);
    expect(selection.macro.mainCommand).to.not.equal(Command.Pass);
    expect(selection.evaluation.tempo).to.not.equal(null);
    expect(selection.evaluation.tempo.productive).to.equal(true);
  });
});
