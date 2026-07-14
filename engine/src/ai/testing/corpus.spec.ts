import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { Command, Phase } from "../../enums";
import { buildCommittedTurnMacros } from "../actions/turn-builder";
import { canonicalStateHash } from "../canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { expandAtomicDecisions } from "../actions/expand";
import { playMacroGame, runMacroCorpusCampaign } from "./corpus";

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove)?.faction ?? `p${engine.playerToMove + 1}`;
}

function lockedRoundOneEngine(): Engine {
  const engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard, "locked setup must terminate").to.be.greaterThan(0);
  }
  expect(engine.phase).to.equal(Phase.RoundMove);
  return engine;
}

function smallOreWallet(engine: Engine, ores: number): Engine {
  const player = engine.player(engine.playerToMove);
  player.data.credits = 0;
  player.data.ores = ores;
  player.data.knowledge = 0;
  player.data.qics = 0;
  player.data.power.area1 = 0;
  player.data.power.area2 = 0;
  player.data.power.area3 = 0;
  player.data.power.gaia = 0;
  player.data.brainstone = null;
  engine.clearAvailableCommands();
  player.federationCache = null;
  return engine;
}

const CAMPAIGN_SEEDS = Array.from(
  { length: 20 },
  (_, index) => `phase-1-4-corpus-${String(index + 1).padStart(2, "0")}`
);

describe("Phase 1.4 macro corpus campaign", function () {
  // Full macro-driven games; the 1,000-state campaign legitimately runs for minutes.
  this.timeout(90 * 60 * 1000);

  it("plays sampled macro play to EndGame including an exact uncapped conversion turn", () => {
    // Exhaustive planning cost is wallet-dependent (measured seconds on lean wallets, hours on
    // rich ones), so the sampled game defers conversions on most turns — a play-policy choice —
    // and one measured mid-game state gets the complete, uncapped Phase 1.3 integration.
    const capture: { serialized?: string } = {};
    const game = playMacroGame({
      playSeed: "phase-1-4-sampled-01",
      onState: (record, engine) => {
        if (record.phase === Phase.RoundMove && record.round === 3) {
          capture.serialized = JSON.stringify(engine);
        }
      },
    });
    expect(game.finished).to.equal(true);
    expect(game.finalRound).to.equal(6);
    expect(game.finalEngine.phase).to.equal(Phase.EndGame);
    expect(game.branchStatistics.off.states).to.equal(game.states);
    expect(game.commandCoverage).to.include(Command.Pass);
    expect(capture.serialized).to.not.equal(undefined);

    const integrationSource = Engine.fromData(JSON.parse(capture.serialized));
    const integrated = buildCommittedTurnMacros(integrationSource, {
      conversionIntegration: true,
      afterConversionIntegration: false,
    });
    const prefixed = integrated.macros.filter((macro) => macro.conversionPlanKey !== null);
    expect(prefixed.length, "integration must expose conversion-prefixed macros").to.be.greaterThan(0);
    const deepest = prefixed.reduce((best, macro) =>
      macro.moveFragments.length > best.moveFragments.length ? macro : best
    );
    const committed = Engine.fromData(JSON.parse(capture.serialized));
    committed.move(deepest.moveLine);
    expect(committed.newTurn).to.equal(true);
    expect(canonicalStateHash(committed)).to.equal(deepest.destination.stateHash);

    // The conversion-committed line joins real play: continue to EndGame from it.
    const continuation = playMacroGame({
      playSeed: "phase-1-4-sampled-01-continuation",
      startEngine: committed,
    });
    expect(continuation.finished).to.equal(true);
    expect(continuation.finalEngine.phase).to.equal(Phase.EndGame);
  });

  it("emits uncapped conversion prefixes beyond the fuzzer's historical two-conversion cap", () => {
    const source = smallOreWallet(lockedRoundOneEngine(), 3);
    const macroSet = buildCommittedTurnMacros(source, {
      conversionIntegration: true,
      afterConversionIntegration: false,
    });
    const deep = macroSet.macros.filter((macro) =>
      macro.decisions.some((decision) => decision.kind === "conversion-prefix" && decision.moveFragments.length >= 3)
    );
    expect(deep.length, "conversion prefixes deeper than the fuzzer cap must exist").to.be.greaterThan(0);

    const macro = deep[0];
    const clone = Engine.fromData(JSON.parse(JSON.stringify(source)));
    clone.move(macro.moveLine);
    expect(clone.newTurn).to.equal(true);
    expect(canonicalStateHash(clone)).to.equal(macro.destination.stateHash);
  });

  it("passes hash/legal/apply/replay properties on at least 1,000 diverse committed corpus states", () => {
    const campaign = runMacroCorpusCampaign({
      playSeeds: CAMPAIGN_SEEDS,
      minStates: 1000,
      deepCheckEvery: 7,
    });

    expect(campaign.states).to.be.at.least(1000);
    expect(campaign.finishedGames).to.equal(campaign.games);
    expect(campaign.hydrationHashChecks).to.equal(campaign.states);
    expect(campaign.constructorReplayHashChecks).to.equal(campaign.states);
    expect(campaign.macroKeyParityChecks).to.be.greaterThan(100);
    expect(campaign.leechStates).to.be.greaterThan(0);
    expect(campaign.phasesCovered).to.include.members([
      Phase.SetupBuilding,
      Phase.SetupBooster,
      Phase.RoundMove,
      Phase.RoundLeech,
    ]);
    expect(campaign.roundsCovered).to.include.members([1, 2, 3, 4, 5, 6]);
    expect(
      Object.keys(campaign.rejectedLineReasons).every((reason) => reason === "dead-end-follow-up"),
      `only DeadEnd lines may be rejected, got ${JSON.stringify(campaign.rejectedLineReasons)}`
    ).to.equal(true);
    expect(campaign.commandCoverage).to.include.members([
      Command.Action,
      Command.Build,
      Command.ChargePower,
      Command.ChooseArtifactToken,
      Command.ChooseCoverTechTile,
      Command.ChooseFederationTile,
      Command.ChooseRoundBooster,
      Command.ChooseTechTile,
      Command.Decline,
      Command.EndTurn,
      Command.ExamineArtifact,
      Command.Explore,
      Command.FormFederation,
      Command.GaiaFormTransdim,
      Command.Pass,
      Command.SpaceshipAction,
      Command.Special,
      Command.UpgradeResearch,
    ]);
    expect(campaign.branchStatistics.off.states).to.equal(campaign.states);
    expect(campaign.branchStatistics.off.totalMacros).to.be.greaterThan(campaign.states);
    // Both engine-reality findings must have been exercised and surfaced, never silently skipped:
    // the custom-federation fallback marker and the documented federationCache replay divergence.
    expect(campaign.unsupportedCustomFederationStates).to.be.greaterThan(0);
    expect(campaign.federationCacheHashDivergences).to.be.greaterThan(0);
  });
});
