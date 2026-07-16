import Engine from "../../engine";
import { CommittedTurnMacro, CommittedTurnMacroBuildOptions } from "../actions/turn-builder";
import { HeuristicEvaluationOptions } from "../evaluation";
import { GreedyValueMode } from "./greedy";
import { FixedFrameSearch, RootReuseVisitPolicy, SearchDiagnostics, SearchMode } from "../search/core";
import {
  EngineSearchDomain,
  NonNeuralPriorOptions,
  NonNeuralPriorReport,
  pinnedSearchMacroBuildOptions,
} from "../search/engine-domain";
import { MacroBot, MacroBotSelection } from "./types";

export const SEARCH_MACRO_EVALUATION_SCHEMA = "gaia-ai-search-macro-evaluation/v1" as const;

export interface SearchMacroBotOptions {
  simulations: number;
  mode?: SearchMode;
  explorationConstant?: number;
  puctValueScale?: number;
  rootReuseVisitPolicy?: RootReuseVisitPolicy;
  seed?: string;
  gumbelMaxActions?: number;
  gumbelValueScale?: number;
  transpositions?: boolean;
  macroBuildOptions?: CommittedTurnMacroBuildOptions;
  evaluation?: Omit<HeuristicEvaluationOptions, "transition">;
  leafGreedyMix?: number;
  greedyValueMode?: GreedyValueMode;
  nonTerminalPassValuePenalty?: number;
  prior?: NonNeuralPriorOptions;
}

export interface SearchMacroEvaluation {
  schemaVersion: typeof SEARCH_MACRO_EVALUATION_SCHEMA;
  value: number;
  macroBuildOptions: CommittedTurnMacroBuildOptions;
  prior: NonNeuralPriorReport;
  diagnostics: SearchDiagnostics;
}

export function isSearchMacroEvaluation(value: unknown): value is SearchMacroEvaluation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    Object.prototype.hasOwnProperty.call(value, "schemaVersion") &&
    Object.prototype.hasOwnProperty.call(value, "diagnostics")
  );
}

/** Stateful offline Phase 2 bot with fixed-budget PUCT or seeded Gumbel root allocation. */
export class SearchMacroBot implements MacroBot<SearchMacroEvaluation> {
  readonly name: string;
  private readonly domain: EngineSearchDomain;
  private readonly searchTree: FixedFrameSearch<Engine, CommittedTurnMacro>;

  constructor(private readonly options: SearchMacroBotOptions) {
    const mode = options.mode ?? "puct";
    this.name = mode === "puct" ? "puct-search" : "gumbel-search";
    this.domain = new EngineSearchDomain({
      macroBuildOptions: pinnedSearchMacroBuildOptions(options.macroBuildOptions),
      evaluation: options.evaluation,
      leafGreedyMix: options.leafGreedyMix,
      greedyValueMode: options.greedyValueMode,
      nonTerminalPassValuePenalty: options.nonTerminalPassValuePenalty,
      prior: options.prior,
    });
    this.searchTree = new FixedFrameSearch(this.domain, {
      simulations: options.simulations,
      mode,
      explorationConstant: options.explorationConstant,
      puctValueScale: options.puctValueScale,
      rootReuseVisitPolicy: options.rootReuseVisitPolicy,
      seed: options.seed,
      gumbelMaxActions: options.gumbelMaxActions,
      gumbelValueScale: options.gumbelValueScale,
      transpositions: options.transpositions,
    });
  }

  select(engine: Engine): MacroBotSelection<SearchMacroEvaluation> {
    const result = this.searchTree.search(engine);
    const rootKey = result.diagnostics.deterministic.rootStateKey;
    const macroSet = this.domain.macroSet(rootKey);
    const macro = result.action;
    if (!macroSet.macros.some((candidate) => candidate.key === macro.key)) {
      throw new Error(`Search selected macro ${macro.key} outside its committed macro set`);
    }
    const evaluation: SearchMacroEvaluation = {
      schemaVersion: SEARCH_MACRO_EVALUATION_SCHEMA,
      value: result.diagnostics.deterministic.selectedMeanValue,
      macroBuildOptions: this.domain.macroBuildOptions,
      prior: this.domain.priorReport(rootKey),
      diagnostics: result.diagnostics,
    };
    this.searchTree.advanceSelectedAction(result.actionKey);
    return {
      bot: this.name,
      macroSet,
      macro,
      evaluation,
    };
  }

  reset(): void {
    this.searchTree.reset();
  }
}
