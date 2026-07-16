import { Player } from "../../enums";
import { GreedyMacroBot } from "../bots/greedy";
import { HeuristicMacroBot } from "../bots/heuristic";
import { SearchMacroBot, SearchMacroBotOptions } from "../bots/search";
import {
  buildCuratedSearchPositions,
  measureCuratedSearchPositions,
  runSearchStrengthCampaign,
  StrengthCampaignResult,
  StrengthOpponent,
} from "./strength";

const CAMPAIGN_SCHEMA = "gaia-ai-7-strength-campaign/v1" as const;
const SIMULATIONS = 8;
const COMMON_SEEDS = ["ai-7-common-01", "ai-7-common-02", "ai-7-common-03", "ai-7-common-04"];
const PRODUCTIVITY_SEEDS = ["ai-7-productivity-01"];

const opponents: StrengthOpponent[] = [
  {
    name: "greedy-macro",
    factory: () => new GreedyMacroBot(),
  },
  {
    name: "heuristic-macro",
    factory: () => new HeuristicMacroBot(),
  },
];

interface CampaignArm {
  label: string;
  options: SearchMacroBotOptions;
  seeds: string[];
}

const arms: CampaignArm[] = [
  {
    label: "plain-puct-tree",
    options: { simulations: SIMULATIONS, mode: "puct", transpositions: false },
    seeds: [COMMON_SEEDS[0]],
  },
  {
    label: "gumbel-sequential-halving-tree",
    options: {
      simulations: SIMULATIONS,
      mode: "gumbel-sequential-halving",
      gumbelMaxActions: 4,
      transpositions: false,
    },
    seeds: COMMON_SEEDS,
  },
  {
    label: "gumbel-sequential-halving-dag-ablation",
    options: {
      simulations: SIMULATIONS,
      mode: "gumbel-sequential-halving",
      gumbelMaxActions: 4,
      transpositions: true,
    },
    seeds: [COMMON_SEEDS[0]],
  },
];

/**
 * Predeclared before measurement on 2026-07-15. Run only with --scaled-greedy-75-candidate;
 * never combine it with the historical frozen arms in one campaign invocation.
 */
const SCALED_GREEDY_75_CANDIDATE: CampaignArm = {
  label: "scaled-greedy-75-puct-tree",
  options: {
    simulations: SIMULATIONS,
    mode: "puct",
    puctValueScale: 16,
    leafGreedyMix: 0.75,
    prior: { greedyMix: 0.75 },
    rootReuseVisitPolicy: "retain",
    transpositions: false,
  },
  seeds: [COMMON_SEEDS[0]],
};

/**
 * Predeclared before full-game measurement on 2026-07-15. This is a genuinely changed evaluator
 * candidate and uses a fresh seed; it must never rerun the measured scale-16/greedy-75 arm.
 */
const PASS_OPPORTUNITY_4_CANDIDATE: CampaignArm = {
  label: "pass-opportunity-4-puct-tree",
  options: {
    simulations: SIMULATIONS,
    mode: "puct",
    puctValueScale: 16,
    leafGreedyMix: 0.75,
    prior: { greedyMix: 0.75 },
    nonTerminalPassValuePenalty: 4,
    rootReuseVisitPolicy: "retain",
    transpositions: false,
  },
  seeds: PRODUCTIVITY_SEEDS,
};

function botFactory(options: SearchMacroBotOptions): (seat: Player, seed: string) => SearchMacroBot {
  return (_seat, seed) => new SearchMacroBot({ ...options, seed });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function campaignSummary(label: string, campaign: StrengthCampaignResult): object {
  return {
    label,
    candidateBot: campaign.candidateBot,
    seeds: campaign.seeds,
    opponents: campaign.opponents.map((opponent) => ({
      opponent: opponent.opponent,
      candidateMargins: opponent.candidateMargins,
      rawFinalScores: opponent.pairs.map((pair) => ({
        seed: pair.seed,
        candidateAsXenos: {
          xenos: pair.candidateAsXenos.finalSeat0Score,
          hadschHallas: pair.candidateAsXenos.finalSeat1Score,
          candidateMargin: pair.candidateAsXenos.candidateMargin,
        },
        candidateAsHadschHallas: {
          xenos: pair.candidateAsHadschHallas.finalSeat0Score,
          hadschHallas: pair.candidateAsHadschHallas.finalSeat1Score,
          candidateMargin: pair.candidateAsHadschHallas.candidateMargin,
        },
      })),
      fullGameReports: opponent.pairs.map((pair) => ({
        seed: pair.seed,
        candidateAsXenos: pair.candidateAsXenos.fullGameReport,
        candidateAsHadschHallas: pair.candidateAsHadschHallas.fullGameReport,
      })),
      pairedMarginSum: opponent.pairedMarginSum,
      pairedMarginMean: round(opponent.pairedMarginMean),
      record: `${opponent.candidateWins}-${opponent.draws}-${opponent.opponentWins}`,
      worstMargin: opponent.worstMargin,
      committedLines: opponent.pairs.map((pair) => [
        pair.candidateAsXenos.committedLines,
        pair.candidateAsHadschHallas.committedLines,
      ]),
      telemetry: {
        selections: opponent.telemetry.selections,
        simulations: opponent.telemetry.simulations,
        expansions: opponent.telemetry.expansions,
        expandedEdges: opponent.telemetry.expandedEdges,
        elapsedMs: opponent.telemetry.elapsedMs,
        meanSearchLatencyMs: round(opponent.telemetry.elapsedMs / opponent.telemetry.selections),
        reuseEvents: opponent.telemetry.reuseEvents,
        availableVisits: opponent.telemetry.availableVisits,
        reusedVisits: opponent.telemetry.reusedVisits,
        transpositionHits: opponent.telemetry.transpositionHits,
        transpositionParityChecks: opponent.telemetry.transpositionParityChecks,
      },
    })),
  };
}

function run(): void {
  const calibratedCandidateOnly = process.argv.includes("--scaled-greedy-75-candidate");
  const productivityCandidateOnly = process.argv.includes("--pass-opportunity-4-candidate");
  if (calibratedCandidateOnly && productivityCandidateOnly) {
    throw new Error("Choose at most one isolated candidate campaign");
  }
  const selectedArms = calibratedCandidateOnly
    ? [SCALED_GREEDY_75_CANDIDATE]
    : productivityCandidateOnly
    ? [PASS_OPPORTUNITY_4_CANDIDATE]
    : arms;
  const results = selectedArms.map((arm) =>
    campaignSummary(arm.label, runSearchStrengthCampaign(botFactory(arm.options), opponents, arm.seeds))
  );
  const positions = buildCuratedSearchPositions();
  const curated = selectedArms.map((arm) => ({
    label: arm.label,
    measurements: measureCuratedSearchPositions(positions, botFactory(arm.options), COMMON_SEEDS[0]).map(
      (measurement) => ({
        label: measurement.label,
        stateHash: measurement.stateHash,
        actor: measurement.actor,
        selectedMacroKey: measurement.selectedMacroKey,
        fixedFrameValue: round(measurement.fixedFrameValue),
        simulations: measurement.diagnostics.deterministic.completedSimulations,
        expansions: measurement.diagnostics.deterministic.expansions,
        elapsedMs: measurement.diagnostics.performance.elapsedMs,
        transpositionHits: measurement.diagnostics.deterministic.transpositions.hits,
        reuse: measurement.diagnostics.deterministic.reuse.kind,
      })
    ),
  }));
  console.log(
    JSON.stringify(
      {
        schemaVersion: CAMPAIGN_SCHEMA,
        simulationsPerSelection: SIMULATIONS,
        calibratedCandidateOnly,
        productivityCandidateOnly,
        macroBuildOptions: { conversionIntegration: false, afterConversionIntegration: false },
        results,
        curated,
      },
      null,
      2
    )
  );
}

run();
