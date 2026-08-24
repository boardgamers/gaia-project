import Engine from "../../engine";
import { Player } from "../../enums";
import { CommittedTurnMacro } from "../actions/turn-builder";
import { applyMacroHostStyle } from "../bots/common";
import { GreedyMacroBot, greedyStateValue } from "../bots/greedy";
import { HeuristicMacroBot } from "../bots/heuristic";
import { SearchMacroBot } from "../bots/search";
import { canonicalStateHash } from "../canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { evaluateHeuristic } from "../evaluation";
import { RootReuseVisitPolicy } from "../search/core";
import { NonNeuralPriorEntry, NonNeuralPriorOptions } from "../search/engine-domain";
import { buildCuratedSearchPositions } from "./strength";

const CALIBRATION_SCHEMA = "gaia-ai-7-search-calibration/v2" as const;
const BUDGETS = [1, 2, 4, 8, 16] as const;
const TRACE_BUDGET = 8;
const MAX_TRACE_COMMITTED_LINES = 32;
const MAX_MATERIAL_DIVERGENCES = 2;
const MATERIAL_GREEDY_GAP = 1;

interface CalibrationArm {
  label:
    "frozen-raw-heuristic" | "scaled-greedy-75-retain" | "scaled-greedy-75-reset-subtree" | "pass-opportunity-4-retain";
  puctValueScale: number;
  leafGreedyMix: number;
  prior: NonNeuralPriorOptions;
  rootReuseVisitPolicy: RootReuseVisitPolicy;
  nonTerminalPassValuePenalty: number;
}

const FROZEN_ARM: CalibrationArm = {
  label: "frozen-raw-heuristic",
  puctValueScale: 1,
  leafGreedyMix: 0,
  prior: { greedyMix: 0 },
  rootReuseVisitPolicy: "retain",
  nonTerminalPassValuePenalty: 0,
};

const CANDIDATE_ARM: CalibrationArm = {
  label: "scaled-greedy-75-retain",
  puctValueScale: 16,
  leafGreedyMix: 0.75,
  prior: { greedyMix: 0.75 },
  rootReuseVisitPolicy: "retain",
  nonTerminalPassValuePenalty: 0,
};

const RESET_REUSE_ARM: CalibrationArm = {
  ...CANDIDATE_ARM,
  label: "scaled-greedy-75-reset-subtree",
  rootReuseVisitPolicy: "reset-subtree",
};

const PRODUCTIVITY_ARM: CalibrationArm = {
  ...CANDIDATE_ARM,
  label: "pass-opportunity-4-retain",
  nonTerminalPassValuePenalty: 4,
};

const PRODUCTIVITY_ONLY = process.argv.includes("--productivity-candidate");
const CURATED_ARMS: CalibrationArm[] = PRODUCTIVITY_ONLY ? [PRODUCTIVITY_ARM] : [FROZEN_ARM, CANDIDATE_ARM];
const TRACE_ARMS: CalibrationArm[] = PRODUCTIVITY_ONLY ? [PRODUCTIVITY_ARM] : [CANDIDATE_ARM, RESET_REUSE_ARM];

function actorOriented(actor: Player, value: number): number {
  return actor === Player.Player1 ? value : -value;
}

function searchBot(simulations: number, seed: string, arm: CalibrationArm): SearchMacroBot {
  return new SearchMacroBot({
    simulations,
    seed,
    mode: "puct",
    transpositions: false,
    puctValueScale: arm.puctValueScale,
    leafGreedyMix: arm.leafGreedyMix,
    rootReuseVisitPolicy: arm.rootReuseVisitPolicy,
    nonTerminalPassValuePenalty: arm.nonTerminalPassValuePenalty,
    macroBuildOptions: { conversionIntegration: false, afterConversionIntegration: false },
    prior: arm.prior,
  });
}

function rankBy(
  entries: NonNeuralPriorEntry[],
  macroKey: string,
  value: (entry: NonNeuralPriorEntry) => number
): number {
  return (
    [...entries]
      .sort((left, right) => value(right) - value(left) || left.macroKey.localeCompare(right.macroKey))
      .findIndex((entry) => entry.macroKey === macroKey) + 1
  );
}

function macroProfile(source: Engine, macro: CommittedTurnMacro): object {
  const destination = applyMacroHostStyle(source, macro);
  const greedyValue = greedyStateValue(destination);
  const heuristicValue = evaluateHeuristic(destination, { transition: { source, macro } }).value;
  return {
    macroKey: macro.key,
    mainCommand: macro.mainCommand,
    mainCandidateKey: macro.mainCandidateKey,
    moveLine: macro.moveLine,
    greedyFixedFrameValue: greedyValue,
    greedyActorValue: actorOriented(macro.actor, greedyValue),
    heuristicFixedFrameValue: heuristicValue,
    heuristicActorValue: actorOriented(macro.actor, heuristicValue),
  };
}

function priorEntryProfile(entries: NonNeuralPriorEntry[], macroKey: string): object {
  const entry = entries.find((candidate) => candidate.macroKey === macroKey);
  if (!entry) {
    throw new Error(`Missing prior entry for ${macroKey}`);
  }
  return {
    prior: entry.prior,
    stateOnlyHeuristicFixedFrameValue: entry.heuristicFixedFrameValue,
    stateOnlyHeuristicActorValue: entry.heuristicOrientedValue,
    searchLeafFixedFrameValue: entry.fixedFrameValue,
    searchLeafActorValue: entry.orientedValue,
    greedyFixedFrameValue: entry.greedyFixedFrameValue,
    greedyActorValue: entry.greedyOrientedValue,
  };
}

function heuristicPreferenceBreakdown(
  source: Engine,
  selected: CommittedTurnMacro,
  greedy: CommittedTurnMacro
): object[] {
  const selectedEvaluation = evaluateHeuristic(applyMacroHostStyle(source, selected), {
    transition: { source, macro: selected },
  });
  const greedyEvaluation = evaluateHeuristic(applyMacroHostStyle(source, greedy), {
    transition: { source, macro: greedy },
  });
  const greedyContributions = new Map(
    greedyEvaluation.features.map((feature) => [feature.feature, feature.contribution])
  );
  return selectedEvaluation.features
    .map((feature) => ({
      feature: feature.feature,
      selectedContribution: feature.contribution,
      greedyContribution: greedyContributions.get(feature.feature) ?? 0,
      selectedActorAdvantage: actorOriented(
        selected.actor,
        feature.contribution - (greedyContributions.get(feature.feature) ?? 0)
      ),
    }))
    .filter((feature) => Math.abs(feature.selectedActorAdvantage) > 1e-9)
    .sort(
      (left, right) =>
        Math.abs(right.selectedActorAdvantage) - Math.abs(left.selectedActorAdvantage) ||
        left.feature.localeCompare(right.feature)
    )
    .slice(0, 8);
}

function traceFirstMaterialDivergences(candidateSeat: Player, arm: CalibrationArm): object {
  let engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  const candidate = searchBot(TRACE_BUDGET, `ai-7-calibration-trace:${arm.label}:${candidateSeat}`, arm);
  const opponent = new GreedyMacroBot();
  const divergences: object[] = [];
  let differentChoices = 0;
  let freshDecisionDifferences = 0;
  let availableVisitEvents = 0;
  let retainedVisitEvents = 0;
  let committedLines = 0;
  while (!engine.ended && committedLines < MAX_TRACE_COMMITTED_LINES && divergences.length < MAX_MATERIAL_DIVERGENCES) {
    if (engine.playerToMove !== candidateSeat) {
      engine = applyMacroHostStyle(engine, opponent.select(engine).macro);
      committedLines += 1;
      continue;
    }
    const greedy = new GreedyMacroBot().select(engine);
    const selected = candidate.select(engine);
    const fresh = searchBot(
      TRACE_BUDGET,
      `ai-7-calibration-trace-fresh:${arm.label}:${candidateSeat}:${committedLines}`,
      arm
    ).select(engine);
    const reuse = selected.evaluation.diagnostics.deterministic.reuse;
    freshDecisionDifferences += Number(fresh.macro.key !== selected.macro.key);
    availableVisitEvents += Number(reuse.availableVisits > 0);
    retainedVisitEvents += Number(reuse.reusedVisits > 0);
    if (selected.macro.key !== greedy.macro.key) {
      differentChoices += 1;
      const selectedGreedyValue = greedyStateValue(applyMacroHostStyle(engine, selected.macro));
      const greedyGap = actorOriented(candidateSeat, greedy.evaluation.value - selectedGreedyValue);
      if (greedyGap >= MATERIAL_GREEDY_GAP) {
        const entries = selected.evaluation.prior.entries;
        const rootAction = selected.evaluation.diagnostics.deterministic.rootActions.find(
          (action) => action.key === selected.macro.key
        );
        if (!rootAction) {
          throw new Error(`Missing root diagnostics for ${selected.macro.key}`);
        }
        divergences.push({
          committedLine: committedLines,
          round: engine.round,
          phase: engine.phase,
          actor: candidateSeat,
          stateHash: canonicalStateHash(engine),
          earlierDifferentChoices: differentChoices - 1,
          greedyActorValueGap: greedyGap,
          baselineSearch: {
            ...macroProfile(engine, selected.macro),
            priorEntry: priorEntryProfile(entries, selected.macro.key),
            priorRank: rankBy(entries, selected.macro.key, (entry) => entry.prior),
            heuristicRank: rankBy(entries, selected.macro.key, (entry) => entry.heuristicOrientedValue),
            greedyRank: rankBy(entries, selected.macro.key, (entry) => entry.greedyOrientedValue),
            visits: rootAction.visits,
            visitDelta: rootAction.visitDelta,
            meanValue: rootAction.meanValue,
            reuse: selected.evaluation.diagnostics.deterministic.reuse,
            rootVisits: selected.evaluation.diagnostics.deterministic.rootVisits,
          },
          greedy: {
            ...macroProfile(engine, greedy.macro),
            priorEntry: priorEntryProfile(entries, greedy.macro.key),
          },
          freshBaselineSearch: {
            ...macroProfile(engine, fresh.macro),
            matchesGreedy: fresh.macro.key === greedy.macro.key,
            changedFromStatefulBaseline: fresh.macro.key !== selected.macro.key,
          },
          heuristicPreferenceForBaseline: heuristicPreferenceBreakdown(engine, selected.macro, greedy.macro),
        });
      }
    }
    engine = applyMacroHostStyle(engine, selected.macro);
    committedLines += 1;
  }
  return {
    arm,
    candidateSeat,
    traceBudget: TRACE_BUDGET,
    materialGreedyGap: MATERIAL_GREEDY_GAP,
    committedLines,
    completedGame: engine.ended,
    differentChoices,
    freshDecisionDifferences,
    availableVisitEvents,
    retainedVisitEvents,
    divergences,
    rawFinalScores: engine.ended
      ? {
          seat0: engine.player(Player.Player1).data.victoryPoints,
          seat1: engine.player(Player.Player2).data.victoryPoints,
        }
      : null,
  };
}

function curatedBudgetComparison(): object {
  const positions = buildCuratedSearchPositions();
  const measurements = positions.map((position) => {
    const greedy = new GreedyMacroBot().select(position.engine);
    const heuristic = new HeuristicMacroBot().select(position.engine);
    const arms = CURATED_ARMS.flatMap((arm) =>
      BUDGETS.map((budget) => {
        const selection = searchBot(
          budget,
          `ai-7-calibration-curated:${arm.label}:${position.label}:${budget}`,
          arm
        ).select(position.engine);
        const diagnostics = selection.evaluation.diagnostics.deterministic;
        const entries = selection.evaluation.prior.entries;
        const rootAction = diagnostics.rootActions.find((action) => action.key === selection.macro.key);
        if (!rootAction) {
          throw new Error(`Missing curated root diagnostics for ${selection.macro.key}`);
        }
        return {
          arm: arm.label,
          budget,
          selectedMacroKey: selection.macro.key,
          matchesGreedy: selection.macro.key === greedy.macro.key,
          matchesHeuristic: selection.macro.key === heuristic.macro.key,
          selectedPass: selection.macro.mainCommand === "pass",
          priorRank: rankBy(entries, selection.macro.key, (entry) => entry.prior),
          greedyRank: rankBy(entries, selection.macro.key, (entry) => entry.greedyOrientedValue),
          visitDelta: rootAction.visitDelta,
          rootActionCount: diagnostics.rootActions.length,
          completedSimulations: diagnostics.completedSimulations,
          elapsedMs: selection.evaluation.diagnostics.performance.elapsedMs,
        };
      })
    );
    return {
      label: position.label,
      round: position.round,
      actor: position.actor,
      stateHash: position.stateHash,
      greedyMacroKey: greedy.macro.key,
      heuristicMacroKey: heuristic.macro.key,
      arms,
    };
  });
  const summaries = CURATED_ARMS.flatMap((arm) =>
    BUDGETS.map((budget) => {
      const rows = measurements.map((position) =>
        position.arms.find((measurement) => measurement.arm === arm.label && measurement.budget === budget)
      );
      if (rows.some((row) => !row)) {
        throw new Error(`Missing curated measurement for ${arm.label} at budget ${budget}`);
      }
      return {
        arm: arm.label,
        budget,
        matchesGreedy: rows.filter((row) => row && row.matchesGreedy).length,
        matchesHeuristic: rows.filter((row) => row && row.matchesHeuristic).length,
        selectedPriorRankOne: rows.filter((row) => row && row.priorRank === 1).length,
        selectedPasses: rows.filter((row) => row && row.selectedPass).length,
        totalSimulations: rows.reduce((sum, row) => sum + (row ? row.completedSimulations : 0), 0),
        totalElapsedMs: rows.reduce((sum, row) => sum + (row ? row.elapsedMs : 0), 0),
      };
    })
  );
  return { summaries, measurements };
}

function run(): void {
  const traceOnly = process.argv.includes("--trace-only");
  const curatedOnly = process.argv.includes("--curated-only");
  if (traceOnly && curatedOnly) {
    throw new Error("Choose at most one of --trace-only and --curated-only");
  }
  console.log(
    JSON.stringify(
      {
        schemaVersion: CALIBRATION_SCHEMA,
        constraints: {
          mode: "puct",
          gumbel: false,
          transpositions: false,
          macroBuildOptions: { conversionIntegration: false, afterConversionIntegration: false },
          budgets: BUDGETS,
          curatedArms: CURATED_ARMS,
          reuseTraceArms: TRACE_ARMS,
          traceBudget: TRACE_BUDGET,
          maxTraceCommittedLines: MAX_TRACE_COMMITTED_LINES,
          maxMaterialDivergences: MAX_MATERIAL_DIVERGENCES,
          materialGreedyGap: MATERIAL_GREEDY_GAP,
          finalScoreReporting: "completed games require both raw seat scores; these traces stop before EndGame",
        },
        firstMaterialDivergences: curatedOnly
          ? null
          : TRACE_ARMS.flatMap((arm) => [
              traceFirstMaterialDivergences(Player.Player1, arm),
              traceFirstMaterialDivergences(Player.Player2, arm),
            ]),
        curated: traceOnly ? null : curatedBudgetComparison(),
      },
      null,
      2
    )
  );
}

run();
