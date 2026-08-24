import Engine from "../../engine";
import { Faction, Phase, Player } from "../../enums";
import { applyMacroHostStyle, MacroBotError } from "../bots/common";
import { GreedyMacroBot } from "../bots/greedy";
import { HeuristicMacroBot } from "../bots/heuristic";
import { isSearchMacroEvaluation, SearchMacroEvaluation } from "../bots/search";
import { MacroBot } from "../bots/types";
import { canonicalStateHash } from "../canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { terminalUtility } from "../evaluation";
import { FullGameReport, FullGameReportCollector } from "./full-game-report";

export const SEARCH_STRENGTH_SCHEMA = "gaia-ai-search-strength/v1" as const;
export const CURATED_SEARCH_POSITION_SCHEMA = "gaia-ai-curated-search-position/v1" as const;

export interface SearchTelemetryTotals {
  selections: number;
  simulations: number;
  expansions: number;
  expandedEdges: number;
  elapsedMs: number;
  reuseEvents: number;
  availableVisits: number;
  reusedVisits: number;
  transpositionHits: number;
  transpositionParityChecks: number;
}

export interface SearchStrengthGameResult {
  schemaVersion: typeof SEARCH_STRENGTH_SCHEMA;
  candidateBot: string;
  opponentBot: string;
  candidateSeat: Player;
  candidateFaction: Faction;
  opponentFaction: Faction;
  committedLines: number;
  finalSeat0Score: number;
  finalSeat1Score: number;
  finalFixedFrameMargin: number;
  candidateMargin: number;
  telemetry: SearchTelemetryTotals;
  moveHistory: string[];
  fullGameReport: FullGameReport;
  finalEngine: Engine;
}

export interface PairedSearchStrengthResult {
  schemaVersion: typeof SEARCH_STRENGTH_SCHEMA;
  seed: string;
  candidateBot: string;
  opponentBot: string;
  candidateAsXenos: SearchStrengthGameResult;
  candidateAsHadschHallas: SearchStrengthGameResult;
  candidateMargins: [number, number];
  pairedMarginSum: number;
  pairedMarginMean: number;
  candidateWins: number;
  draws: number;
  opponentWins: number;
  telemetry: SearchTelemetryTotals;
}

export interface StrengthOpponent {
  name: string;
  factory: (seat: Player, label: string) => MacroBot;
}

export type StrengthSearchBotFactory = (seat: Player, searchSeed: string) => MacroBot<SearchMacroEvaluation>;

export interface StrengthCampaignOpponentResult {
  opponent: string;
  pairs: PairedSearchStrengthResult[];
  candidateMargins: number[];
  pairedMarginSum: number;
  pairedMarginMean: number;
  candidateWins: number;
  draws: number;
  opponentWins: number;
  worstMargin: number;
  telemetry: SearchTelemetryTotals;
}

export interface StrengthCampaignResult {
  schemaVersion: typeof SEARCH_STRENGTH_SCHEMA;
  candidateBot: string;
  seeds: string[];
  opponents: StrengthCampaignOpponentResult[];
}

export interface CuratedSearchPosition {
  schemaVersion: typeof CURATED_SEARCH_POSITION_SCHEMA;
  source: "greedy-xenos-v-heuristic-hadsch-hallas/v1";
  label: "setup" | "round-1" | "round-2" | "round-3" | "round-4" | "round-5" | "round-6";
  phase: Phase;
  round: number;
  actor: Player;
  stateHash: string;
  engine: Engine;
}

export interface CuratedSearchMeasurement {
  label: CuratedSearchPosition["label"];
  stateHash: string;
  actor: Player;
  selectedMacroKey: string;
  fixedFrameValue: number;
  diagnostics: SearchMacroEvaluation["diagnostics"];
}

function emptyTelemetry(): SearchTelemetryTotals {
  return {
    selections: 0,
    simulations: 0,
    expansions: 0,
    expandedEdges: 0,
    elapsedMs: 0,
    reuseEvents: 0,
    availableVisits: 0,
    reusedVisits: 0,
    transpositionHits: 0,
    transpositionParityChecks: 0,
  };
}

function addTelemetry(target: SearchTelemetryTotals, source: SearchTelemetryTotals): void {
  target.selections += source.selections;
  target.simulations += source.simulations;
  target.expansions += source.expansions;
  target.expandedEdges += source.expandedEdges;
  target.elapsedMs += source.elapsedMs;
  target.reuseEvents += source.reuseEvents;
  target.availableVisits += source.availableVisits;
  target.reusedVisits += source.reusedVisits;
  target.transpositionHits += source.transpositionHits;
  target.transpositionParityChecks += source.transpositionParityChecks;
}

function recordSearchTelemetry(target: SearchTelemetryTotals, evaluation: SearchMacroEvaluation): void {
  const deterministic = evaluation.diagnostics.deterministic;
  target.selections += 1;
  target.simulations += deterministic.completedSimulations;
  target.expansions += deterministic.expansions;
  target.expandedEdges += deterministic.expandedEdges;
  target.elapsedMs += evaluation.diagnostics.performance.elapsedMs;
  if (deterministic.reuse.kind !== "fresh") {
    target.reuseEvents += 1;
  }
  target.availableVisits += deterministic.reuse.availableVisits;
  target.reusedVisits += deterministic.reuse.reusedVisits;
  target.transpositionHits += deterministic.transpositions.hits;
  target.transpositionParityChecks += deterministic.transpositions.parityChecks;
}

function factionForSeat(seat: Player): Faction {
  return seat === Player.Player1 ? Faction.Xenos : Faction.HadschHallas;
}

function roundPositionLabel(round: number): CuratedSearchPosition["label"] | null {
  switch (round) {
    case 1:
      return "round-1";
    case 2:
      return "round-2";
    case 3:
      return "round-3";
    case 4:
      return "round-4";
    case 5:
      return "round-5";
    case 6:
      return "round-6";
    default:
      return null;
  }
}

export function playSearchStrengthGame(
  candidateSeat: Player,
  candidate: MacroBot<SearchMacroEvaluation>,
  opponent: MacroBot,
  maxCommittedLines = 800
): SearchStrengthGameResult {
  let engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  const reportCollector = new FullGameReportCollector(engine);
  const telemetry = emptyTelemetry();
  let committedLines = 0;
  while (!engine.ended) {
    if (committedLines >= maxCommittedLines) {
      throw new MacroBotError(
        `Strength game ${candidate.name}/${opponent.name} did not finish within ${maxCommittedLines} committed lines`
      );
    }
    const actor = engine.playerToMove;
    const bot = actor === candidateSeat ? candidate : opponent;
    const selection = bot.select(engine);
    if (
      selection.macro.actor !== actor ||
      !selection.macroSet.macros.some((macro) => macro.key === selection.macro.key)
    ) {
      throw new MacroBotError(`${bot.name} selected outside its Phase 1.4 committed macro set`);
    }
    if (actor === candidateSeat) {
      if (!isSearchMacroEvaluation(selection.evaluation)) {
        throw new MacroBotError(`Candidate ${candidate.name} did not expose search diagnostics`);
      }
      recordSearchTelemetry(telemetry, selection.evaluation);
    }
    const source = engine;
    engine = applyMacroHostStyle(source, selection.macro);
    reportCollector.record(source, selection.macro, engine);
    committedLines += 1;
  }
  const finalFixedFrameMargin = terminalUtility(engine);
  return {
    schemaVersion: SEARCH_STRENGTH_SCHEMA,
    candidateBot: candidate.name,
    opponentBot: opponent.name,
    candidateSeat,
    candidateFaction: factionForSeat(candidateSeat),
    opponentFaction: factionForSeat(candidateSeat === Player.Player1 ? Player.Player2 : Player.Player1),
    committedLines,
    finalSeat0Score: engine.player(Player.Player1).data.victoryPoints,
    finalSeat1Score: engine.player(Player.Player2).data.victoryPoints,
    finalFixedFrameMargin,
    candidateMargin: candidateSeat === Player.Player1 ? finalFixedFrameMargin : -finalFixedFrameMargin,
    telemetry,
    moveHistory: [...engine.moveHistory],
    fullGameReport: reportCollector.finish(engine),
    finalEngine: engine,
  };
}

export function playPairedSearchStrengthMatchup(
  candidateFactory: StrengthSearchBotFactory,
  opponent: StrengthOpponent,
  seed: string
): PairedSearchStrengthResult {
  const candidateAsXenos = playSearchStrengthGame(
    Player.Player1,
    candidateFactory(Player.Player1, `${seed}:xenos`),
    opponent.factory(Player.Player2, `${seed}:xenos`)
  );
  const candidateAsHadschHallas = playSearchStrengthGame(
    Player.Player2,
    candidateFactory(Player.Player2, `${seed}:hadsch-hallas`),
    opponent.factory(Player.Player1, `${seed}:hadsch-hallas`)
  );
  const candidateMargins: [number, number] = [
    candidateAsXenos.candidateMargin,
    candidateAsHadschHallas.candidateMargin,
  ];
  const telemetry = emptyTelemetry();
  addTelemetry(telemetry, candidateAsXenos.telemetry);
  addTelemetry(telemetry, candidateAsHadschHallas.telemetry);
  const pairedMarginSum = candidateMargins[0] + candidateMargins[1];
  return {
    schemaVersion: SEARCH_STRENGTH_SCHEMA,
    seed,
    candidateBot: candidateAsXenos.candidateBot,
    opponentBot: opponent.name,
    candidateAsXenos,
    candidateAsHadschHallas,
    candidateMargins,
    pairedMarginSum,
    pairedMarginMean: pairedMarginSum / 2,
    candidateWins: candidateMargins.filter((margin) => margin > 0).length,
    draws: candidateMargins.filter((margin) => margin === 0).length,
    opponentWins: candidateMargins.filter((margin) => margin < 0).length,
    telemetry,
  };
}

export function runSearchStrengthCampaign(
  candidateFactory: StrengthSearchBotFactory,
  opponents: StrengthOpponent[],
  seeds: string[]
): StrengthCampaignResult {
  if (seeds.length === 0 || opponents.length === 0) {
    throw new Error("Strength campaign requires at least one seed and one opponent");
  }
  const opponentResults = opponents.map((opponent): StrengthCampaignOpponentResult => {
    const pairs = seeds.map((seed) => playPairedSearchStrengthMatchup(candidateFactory, opponent, seed));
    const candidateMargins = pairs.flatMap((pair) => pair.candidateMargins);
    const telemetry = emptyTelemetry();
    for (const pair of pairs) {
      addTelemetry(telemetry, pair.telemetry);
    }
    const pairedMarginSum = candidateMargins.reduce((sum, margin) => sum + margin, 0);
    return {
      opponent: opponent.name,
      pairs,
      candidateMargins,
      pairedMarginSum,
      pairedMarginMean: pairedMarginSum / candidateMargins.length,
      candidateWins: candidateMargins.filter((margin) => margin > 0).length,
      draws: candidateMargins.filter((margin) => margin === 0).length,
      opponentWins: candidateMargins.filter((margin) => margin < 0).length,
      worstMargin: Math.min(...candidateMargins),
      telemetry,
    };
  });
  return {
    schemaVersion: SEARCH_STRENGTH_SCHEMA,
    candidateBot: opponentResults[0].pairs[0].candidateBot,
    seeds: [...seeds],
    opponents: opponentResults,
  };
}

/** Stable first-decision snapshots from one deterministic, fully committed baseline line. */
export function buildCuratedSearchPositions(maxCommittedLines = 800): CuratedSearchPosition[] {
  let engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  const greedy = new GreedyMacroBot();
  const heuristic = new HeuristicMacroBot();
  const positions: CuratedSearchPosition[] = [];
  const captured = new Set<string>();
  let committedLines = 0;
  while (!engine.ended && positions.length < 7) {
    let label: CuratedSearchPosition["label"] | null = null;
    if (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
      label = "setup";
    } else if (engine.phase === Phase.RoundMove && engine.round >= 1 && engine.round <= 6) {
      label = roundPositionLabel(engine.round);
    }
    if (label && !captured.has(label)) {
      captured.add(label);
      positions.push({
        schemaVersion: CURATED_SEARCH_POSITION_SCHEMA,
        source: "greedy-xenos-v-heuristic-hadsch-hallas/v1",
        label,
        phase: engine.phase,
        round: engine.round,
        actor: engine.playerToMove,
        stateHash: canonicalStateHash(engine),
        engine: Engine.fromData(JSON.parse(JSON.stringify(engine))),
      });
    }
    if (committedLines >= maxCommittedLines) {
      throw new MacroBotError(`Curated position line did not finish within ${maxCommittedLines} committed lines`);
    }
    const bot = engine.playerToMove === Player.Player1 ? greedy : heuristic;
    engine = applyMacroHostStyle(engine, bot.select(engine).macro);
    committedLines += 1;
  }
  const expectedLabels = ["setup", "round-1", "round-2", "round-3", "round-4", "round-5", "round-6"];
  if (positions.map((position) => position.label).join("|") !== expectedLabels.join("|")) {
    throw new MacroBotError(`Curated position line missed a required setup/round boundary`);
  }
  return positions;
}

export function measureCuratedSearchPositions(
  positions: CuratedSearchPosition[],
  candidateFactory: StrengthSearchBotFactory,
  seed: string
): CuratedSearchMeasurement[] {
  return positions.map((position): CuratedSearchMeasurement => {
    const bot = candidateFactory(position.actor, `${seed}:${position.label}`);
    const selection = bot.select(position.engine);
    if (!isSearchMacroEvaluation(selection.evaluation)) {
      throw new MacroBotError(`Curated candidate ${bot.name} did not expose search diagnostics`);
    }
    if (!selection.macroSet.macros.some((macro) => macro.key === selection.macro.key)) {
      throw new MacroBotError(`Curated search selected outside its committed macro set at ${position.label}`);
    }
    applyMacroHostStyle(position.engine, selection.macro);
    return {
      label: position.label,
      stateHash: position.stateHash,
      actor: position.actor,
      selectedMacroKey: selection.macro.key,
      fixedFrameValue: selection.evaluation.value,
      diagnostics: selection.evaluation.diagnostics,
    };
  });
}
