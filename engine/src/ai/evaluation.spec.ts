import { expect } from "chai";
import "mocha";
import Engine from "../engine";
import { Building, Command, Phase, Player, PowerArea } from "../enums";
import { buildCommittedTurnMacros } from "./actions/turn-builder";
import { expandAtomicDecisions } from "./actions/expand";
import { applyMacroHostStyle } from "./bots/common";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "./challenge";
import {
  DEFAULT_HEURISTIC_WEIGHTS,
  evaluateHeuristic,
  HEURISTIC_FEATURES,
  orientSeatValues,
  projectedEndgameResourceVictoryPoints,
  terminalUtility,
} from "./evaluation";

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

function adjacentTradingStationSource(): Engine {
  return new Engine(
    [
      "init 2 randomSeed",
      "p1 faction terrans",
      "p2 faction nevlas",
      "terrans build m -1x2",
      "nevlas build m -1x0",
      "nevlas build m 0x-4",
      "terrans build m -4x-1",
      "nevlas booster booster7",
      "terrans booster booster3",
    ],
    {}
  );
}

describe("Phase 2 inspectable heuristic evaluation", () => {
  it("reports every stable feature exactly once with a public default weight", () => {
    const report = evaluateHeuristic(lockedRoundOneEngine());
    expect(report.features.map((feature) => feature.feature)).to.deep.equal([...HEURISTIC_FEATURES]);
    expect(new Set(report.features.map((feature) => feature.feature)).size).to.equal(HEURISTIC_FEATURES.length);
    for (const feature of HEURISTIC_FEATURES) {
      expect(DEFAULT_HEURISTIC_WEIGHTS).to.have.property(feature);
    }
    expect(report.value).to.equal(report.features.reduce((sum, feature) => sum + feature.contribution, 0));
  });

  it("is deterministic and does not mutate the committed source", () => {
    const engine = lockedRoundOneEngine();
    const before = JSON.stringify(engine);
    const first = evaluateHeuristic(engine);
    const second = evaluateHeuristic(engine);
    expect(second).to.deep.equal(first);
    expect(JSON.stringify(engine)).to.equal(before);
  });

  it("applies the owner-labelled Xenos starting-Mine ranking and reports its components", () => {
    const source = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
    const ranked = buildCommittedTurnMacros(source, { conversionIntegration: false })
      .macros.map((macro) => {
        const destination = applyMacroHostStyle(source, macro);
        const report = evaluateHeuristic(destination, { transition: { source, macro } });
        const placement = report.features.find((feature) => feature.feature === "setup-placement-opportunity");
        return {
          coordinates: macro.moveFragments[0].split(" ").pop(),
          value: report.value,
          placement,
        };
      })
      .sort((left, right) => right.value - left.value);

    expect(ranked.map((entry) => entry.coordinates)).to.deep.equal(["3A0", "6A4", "1A3", "2A11"]);
    expect(ranked[0].placement.details.coordinates).to.equal("3A0");
    expect(ranked[0].placement.details.shipAccess).to.be.greaterThan(0);
    expect(ranked[0].placement.details.gaiaAccess).to.be.greaterThan(0);
    expect(ranked[0].placement.details.asteroidAccess).to.be.greaterThan(0);
    expect(ranked[0].placement.details.nearbyPlanetDensity).to.be.greaterThan(0);
  });

  it("limits the setup-placement prior to setup rather than leaking it into ordinary turns", () => {
    const report = evaluateHeuristic(lockedRoundOneEngine());
    const placement = report.features.find((feature) => feature.feature === "setup-placement-opportunity");
    expect(placement.seat0).to.equal(0);
    expect(placement.seat1).to.equal(0);
    expect(placement.contribution).to.equal(0);
  });

  it("ablates every feature independently without changing any other term", () => {
    const engine = lockedRoundOneEngine();
    const baseline = evaluateHeuristic(engine);
    for (const disabled of HEURISTIC_FEATURES) {
      const ablated = evaluateHeuristic(engine, { disabledFeatures: [disabled] });
      const baselineTerm = baseline.features.find((feature) => feature.feature === disabled);
      const ablatedTerm = ablated.features.find((feature) => feature.feature === disabled);
      expect(ablatedTerm.enabled, disabled).to.equal(false);
      expect(ablatedTerm.contribution, disabled).to.equal(0);
      expect(ablated.value, disabled).to.be.closeTo(baseline.value - baselineTerm.contribution, 1e-9);
      for (const term of ablated.features.filter((feature) => feature.feature !== disabled)) {
        expect(term, `${disabled} changed ${term.feature}`).to.deep.equal(
          baseline.features.find((feature) => feature.feature === term.feature)
        );
      }
    }
  });

  it("uses an exact terminal seat-0 margin and locks seat-swap signs", () => {
    const engine = lockedRoundOneEngine();
    engine.player(Player.Player1).data.victoryPoints = 137;
    engine.player(Player.Player2).data.victoryPoints = 121;
    engine.ended = true;
    const report = evaluateHeuristic(engine);
    expect(terminalUtility(engine)).to.equal(16);
    expect(report.terminal).to.equal(true);
    expect(report.terminalScoreMargin).to.equal(16);
    expect(report.value).to.equal(16);
    expect(orientSeatValues(137, 121)).to.equal(16);
    expect(orientSeatValues(121, 137)).to.equal(-16);
    for (const feature of report.features) {
      expect(orientSeatValues(feature.seat1, feature.seat0), feature.feature).to.equal(-feature.rawMargin);
    }
  });

  it("projects final leftover-resource conversion exactly", () => {
    const engine = lockedRoundOneEngine();
    const data = engine.player(Player.Player1).data;
    data.credits = 7;
    data.ores = 4;
    data.knowledge = 5;
    data.qics = 3;
    data.power.area1 = 1;
    data.power.area2 = 5;
    data.power.area3 = 2;
    data.brainstone = PowerArea.Area2;
    const projected = projectedEndgameResourceVictoryPoints(engine.player(Player.Player1));
    const clone = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    const before = clone.player(Player.Player1).data.victoryPoints;
    clone.player(Player.Player1).data.finalResourceHandling();
    expect(clone.player(Player.Player1).data.victoryPoints - before).to.equal(projected);
  });

  it("reports exact marginal leech charge and VP cost from a committed macro edge", () => {
    const source = adjacentTradingStationSource();
    const build = buildCommittedTurnMacros(source, { conversionIntegration: false }).macros.find(
      (macro) => macro.mainCommand === Command.Build && macro.destination.leechPending
    );
    const leech = applyMacroHostStyle(source, build);
    const macros = buildCommittedTurnMacros(leech, { conversionIntegration: false }).macros;
    const charge = macros.find((macro) => macro.mainCommand === Command.ChargePower);
    const destination = applyMacroHostStyle(leech, charge);
    const report = evaluateHeuristic(destination, { transition: { source: leech, macro: charge } });
    const term = report.features.find((feature) => feature.feature === "leech-marginal");
    const actor = charge.actor;
    const exactCost = leech.player(actor).data.victoryPoints - destination.player(actor).data.victoryPoints;
    expect(term.details.command).to.equal(Command.ChargePower);
    expect(term.details.victoryPointCost).to.equal(exactCost);
    expect(term.details.charged).to.be.greaterThan(0);
    expect(term.details.offered).to.equal(leech.player(actor).data.leechPossible);
  });

  it("reports the Trading Station discount against the exact opponent charge offer", () => {
    const source = adjacentTradingStationSource();
    const macro = buildCommittedTurnMacros(source, { conversionIntegration: false }).macros.find(
      (candidate) =>
        candidate.mainCommand === Command.Build &&
        candidate.moveFragments[0].startsWith(`${Command.Build} ${Building.TradingStation} `) &&
        candidate.destination.leechPending
    );
    const destination = applyMacroHostStyle(source, macro);
    const report = evaluateHeuristic(destination, { transition: { source, macro } });
    const term = report.features.find((feature) => feature.feature === "trading-station-adjacency-charge");
    const opponent = macro.actor === Player.Player1 ? Player.Player2 : Player.Player1;
    expect(term.details.adjacentOpponent).to.equal(true);
    expect(term.details.discountCredits).to.equal(3);
    expect(term.details.opponentChargeOffer).to.equal(destination.player(opponent).data.leechPossible);
  });
});
