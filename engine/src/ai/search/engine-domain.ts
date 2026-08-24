import Engine from "../../engine";
import { Command, Player } from "../../enums";
import { CommittedTurnMacro, CommittedTurnMacroBuildOptions, CommittedTurnMacroSet } from "../actions/turn-builder";
import { applyMacroHostStyle, buildBotMacroSet } from "../bots/common";
import { greedyStateValue, GreedyValueMode } from "../bots/greedy";
import { canonicalStateHash } from "../canonical-state";
import { evaluateHeuristic, HeuristicEvaluationOptions, terminalUtility } from "../evaluation";
import { FixedFrameActor, SearchCandidate, SearchDomain } from "./core";

export const NON_NEURAL_PRIOR_SCHEMA = "gaia-ai-non-neural-prior/v1" as const;

export interface NonNeuralPriorOptions {
  /** Shared softmax temperature in fixed-frame heuristic/greedy value units. */
  temperature?: number;
  /** Probability blended uniformly across legal macros so every edge remains explorable. */
  uniformMix?: number;
  /** Probability-level mixture of the immediate greedy softmax into the heuristic softmax. */
  greedyMix?: number;
}

export interface NonNeuralPriorEntry {
  macroKey: string;
  /** Search leaf value after the optional value-level greedy blend. */
  fixedFrameValue: number;
  orientedValue: number;
  centeredValue: number;
  heuristicFixedFrameValue: number;
  heuristicOrientedValue: number;
  greedyFixedFrameValue: number;
  greedyOrientedValue: number;
  greedyCenteredValue: number;
  heuristicProbability: number;
  greedyProbability: number;
  prior: number;
}

export interface NonNeuralPriorReport {
  schemaVersion: typeof NON_NEURAL_PRIOR_SCHEMA;
  policy: "heuristic-softmax-uniform-mix" | "heuristic-greedy-softmax-uniform-mix";
  actor: Player;
  temperature: number;
  uniformMix: number;
  greedyMix: number;
  leafGreedyMix: number;
  nonTerminalPassValuePenalty: number;
  entries: NonNeuralPriorEntry[];
}

export interface EngineSearchDomainOptions {
  macroBuildOptions?: CommittedTurnMacroBuildOptions;
  /** State-only leaf evaluation keeps canonical transposition values path-independent. */
  evaluation?: Omit<HeuristicEvaluationOptions, "transition">;
  /** Value-level blend of immediate greedy into the state-only heuristic leaf evaluation. */
  leafGreedyMix?: number;
  /** The default preserves every frozen search arm's immediate-greedy semantics. */
  greedyValueMode?: GreedyValueMode;
  /** Actor-relative opportunity cost applied only to non-terminal Pass leaf/prior values. */
  nonTerminalPassValuePenalty?: number;
  prior?: NonNeuralPriorOptions;
}

const VALUE_EPSILON = 1e-9;
const DEFAULT_PRIOR_TEMPERATURE = 8;
const DEFAULT_PRIOR_UNIFORM_MIX = 0.05;
const DEFAULT_PRIOR_GREEDY_MIX = 0;

export function pinnedSearchMacroBuildOptions(
  options: CommittedTurnMacroBuildOptions = {}
): CommittedTurnMacroBuildOptions {
  const conversionIntegration = options.conversionIntegration ?? false;
  return {
    conversionIntegration,
    afterConversionIntegration: options.afterConversionIntegration ?? conversionIntegration,
    mainCandidateKeys: options.mainCandidateKeys ? [...options.mainCandidateKeys] : undefined,
  };
}

function fixedFrameActor(player: Player): FixedFrameActor {
  return player === Player.Player1 ? 0 : 1;
}

function stableMacroParity(left: CommittedTurnMacro, right: CommittedTurnMacro): boolean {
  return (
    left.key === right.key &&
    left.sourceStateHash === right.sourceStateHash &&
    left.destination.stateHash === right.destination.stateHash &&
    left.destination.nextActor === right.destination.nextActor &&
    left.destination.gameEnded === right.destination.gameEnded
  );
}

/** Engine-only adapter. Every child is one verified Phase 1.4 host-style committed macro. */
export class EngineSearchDomain implements SearchDomain<Engine, CommittedTurnMacro> {
  readonly macroBuildOptions: CommittedTurnMacroBuildOptions;
  readonly priorOptions: Required<NonNeuralPriorOptions>;
  readonly leafGreedyMix: number;
  readonly greedyValueMode: GreedyValueMode;
  readonly nonTerminalPassValuePenalty: number;
  private readonly macroSets = new Map<string, CommittedTurnMacroSet>();
  private readonly priorReports = new Map<string, NonNeuralPriorReport>();

  constructor(private readonly options: EngineSearchDomainOptions = {}) {
    this.macroBuildOptions = pinnedSearchMacroBuildOptions(options.macroBuildOptions);
    this.priorOptions = {
      temperature: options.prior?.temperature ?? DEFAULT_PRIOR_TEMPERATURE,
      uniformMix: options.prior?.uniformMix ?? DEFAULT_PRIOR_UNIFORM_MIX,
      greedyMix: options.prior?.greedyMix ?? DEFAULT_PRIOR_GREEDY_MIX,
    };
    this.leafGreedyMix = options.leafGreedyMix ?? 0;
    this.greedyValueMode = options.greedyValueMode ?? "immediate";
    this.nonTerminalPassValuePenalty = options.nonTerminalPassValuePenalty ?? 0;
    if (!Number.isFinite(this.priorOptions.temperature) || this.priorOptions.temperature <= 0) {
      throw new Error("Non-neural prior temperature must be positive");
    }
    if (
      !Number.isFinite(this.priorOptions.uniformMix) ||
      this.priorOptions.uniformMix < 0 ||
      this.priorOptions.uniformMix > 1
    ) {
      throw new Error("Non-neural prior uniformMix must be between 0 and 1");
    }
    if (
      !Number.isFinite(this.priorOptions.greedyMix) ||
      this.priorOptions.greedyMix < 0 ||
      this.priorOptions.greedyMix > 1
    ) {
      throw new Error("Non-neural prior greedyMix must be between 0 and 1");
    }
    if (!Number.isFinite(this.leafGreedyMix) || this.leafGreedyMix < 0 || this.leafGreedyMix > 1) {
      throw new Error("Search leafGreedyMix must be between 0 and 1");
    }
    if (!Number.isFinite(this.nonTerminalPassValuePenalty) || this.nonTerminalPassValuePenalty < 0) {
      throw new Error("Search nonTerminalPassValuePenalty must be finite and non-negative");
    }
  }

  stateKey(state: Engine): string {
    return canonicalStateHash(state);
  }

  actor(state: Engine): FixedFrameActor | null {
    if (state.ended || state.playerToMove === undefined || state.playerToMove === null) {
      return null;
    }
    return fixedFrameActor(state.playerToMove);
  }

  terminalValue(state: Engine): number | null {
    return state.ended ? terminalUtility(state) : null;
  }

  evaluate(state: Engine): number {
    const heuristicValue = evaluateHeuristic(state, this.options.evaluation).value;
    return (
      (1 - this.leafGreedyMix) * heuristicValue + this.leafGreedyMix * greedyStateValue(state, this.greedyValueMode)
    );
  }

  expand(state: Engine): Array<SearchCandidate<Engine, CommittedTurnMacro>> {
    const stateKey = this.stateKey(state);
    const macroSet = buildBotMacroSet(state, this.macroBuildOptions);
    if (macroSet.sourceStateHash !== stateKey) {
      throw new Error(`Macro set source ${macroSet.sourceStateHash} does not match search state ${stateKey}`);
    }
    this.macroSets.set(stateKey, macroSet);
    const children = macroSet.macros.map((macro) => {
      const destination = applyMacroHostStyle(state, macro);
      const passAdjustment =
        macro.mainCommand === Command.Pass && !destination.ended
          ? (macroSet.actor === Player.Player1 ? -1 : 1) * this.nonTerminalPassValuePenalty
          : 0;
      const heuristicValue = evaluateHeuristic(destination, this.options.evaluation).value + passAdjustment;
      const greedyValue = greedyStateValue(destination, this.greedyValueMode) + passAdjustment;
      return {
        macro,
        destination,
        heuristicValue,
        greedyValue,
        value: destination.ended
          ? terminalUtility(destination)
          : (1 - this.leafGreedyMix) * heuristicValue + this.leafGreedyMix * greedyValue,
      };
    });
    const orientation = macroSet.actor === Player.Player1 ? 1 : -1;
    const orientedValues = children.map((child) => orientation * child.value);
    const average = orientedValues.reduce((sum, value) => sum + value, 0) / orientedValues.length;
    const heuristicOrientedValues = children.map((child) => orientation * child.heuristicValue);
    const heuristicAverage =
      heuristicOrientedValues.reduce((sum, value) => sum + value, 0) / heuristicOrientedValues.length;
    const heuristicExponentials = heuristicOrientedValues.map((value) =>
      Math.exp(Math.max(-40, Math.min(40, (value - heuristicAverage) / this.priorOptions.temperature)))
    );
    const heuristicExponentialSum = heuristicExponentials.reduce((sum, value) => sum + value, 0);
    const greedyOrientedValues = children.map((child) => orientation * child.greedyValue);
    const greedyAverage = greedyOrientedValues.reduce((sum, value) => sum + value, 0) / greedyOrientedValues.length;
    const greedyExponentials = greedyOrientedValues.map((value) =>
      Math.exp(Math.max(-40, Math.min(40, (value - greedyAverage) / this.priorOptions.temperature)))
    );
    const greedyExponentialSum = greedyExponentials.reduce((sum, value) => sum + value, 0);
    const entries = children.map((child, index): NonNeuralPriorEntry => {
      const heuristicProbability = heuristicExponentials[index] / heuristicExponentialSum;
      const greedyProbability = greedyExponentials[index] / greedyExponentialSum;
      const blendedProbability =
        (1 - this.priorOptions.greedyMix) * heuristicProbability + this.priorOptions.greedyMix * greedyProbability;
      return {
        macroKey: child.macro.key,
        fixedFrameValue: child.value,
        orientedValue: orientedValues[index],
        centeredValue: orientedValues[index] - average,
        heuristicFixedFrameValue: child.heuristicValue,
        heuristicOrientedValue: heuristicOrientedValues[index],
        greedyFixedFrameValue: child.greedyValue,
        greedyOrientedValue: greedyOrientedValues[index],
        greedyCenteredValue: greedyOrientedValues[index] - greedyAverage,
        heuristicProbability,
        greedyProbability,
        prior: (1 - this.priorOptions.uniformMix) * blendedProbability + this.priorOptions.uniformMix / children.length,
      };
    });
    const report: NonNeuralPriorReport = {
      schemaVersion: NON_NEURAL_PRIOR_SCHEMA,
      policy:
        this.priorOptions.greedyMix === 0 ? "heuristic-softmax-uniform-mix" : "heuristic-greedy-softmax-uniform-mix",
      actor: macroSet.actor,
      temperature: this.priorOptions.temperature,
      uniformMix: this.priorOptions.uniformMix,
      greedyMix: this.priorOptions.greedyMix,
      leafGreedyMix: this.leafGreedyMix,
      nonTerminalPassValuePenalty: this.nonTerminalPassValuePenalty,
      entries,
    };
    this.priorReports.set(stateKey, report);
    return children.map((child, index): SearchCandidate<Engine, CommittedTurnMacro> => ({
      key: child.macro.key,
      action: child.macro,
      state: child.destination,
      value: child.value,
      prior: entries[index].prior,
      priorDetails: {
        policy: report.policy,
        rawValue: child.value,
        orientedValue: entries[index].orientedValue,
        centeredValue: entries[index].centeredValue,
        temperature: report.temperature,
      },
    }));
  }

  macroSet(stateKey: string): CommittedTurnMacroSet {
    const macroSet = this.macroSets.get(stateKey);
    if (!macroSet) {
      throw new Error(`No expanded macro set recorded for search state ${stateKey}`);
    }
    return macroSet;
  }

  priorReport(stateKey: string): NonNeuralPriorReport {
    const report = this.priorReports.get(stateKey);
    if (!report) {
      throw new Error(`No prior report recorded for search state ${stateKey}`);
    }
    return report;
  }

  assertTranspositionParity(retained: Engine, candidate: Engine): void {
    const retainedKey = this.stateKey(retained);
    const candidateKey = this.stateKey(candidate);
    if (retainedKey !== candidateKey) {
      throw new Error(`Transposition canonical key mismatch: ${retainedKey} versus ${candidateKey}`);
    }
    const retainedValue = retained.ended ? terminalUtility(retained) : this.evaluate(retained);
    const candidateValue = candidate.ended ? terminalUtility(candidate) : this.evaluate(candidate);
    if (Math.abs(retainedValue - candidateValue) > VALUE_EPSILON) {
      throw new Error(`Transposition heuristic value mismatch at ${retainedKey}`);
    }
    if (retained.ended || candidate.ended) {
      if (retained.ended !== candidate.ended) {
        throw new Error(`Transposition terminal parity mismatch at ${retainedKey}`);
      }
      return;
    }
    const retainedSet = buildBotMacroSet(retained, this.macroBuildOptions);
    const candidateSet = buildBotMacroSet(candidate, this.macroBuildOptions);
    if (
      retainedSet.actor !== candidateSet.actor ||
      retainedSet.macros.length !== candidateSet.macros.length ||
      retainedSet.macros.some((macro, index) => !stableMacroParity(macro, candidateSet.macros[index]))
    ) {
      throw new Error(`Transposition legal macro parity mismatch at ${retainedKey}`);
    }
  }
}
