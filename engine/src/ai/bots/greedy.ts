import Engine from "../../engine";
import { Phase, Player, PowerArea, Resource } from "../../enums";
import { projectedEndgameResourceVictoryPoints, terminalUtility } from "../evaluation";
import { applyMacroHostStyle, buildBotMacroSet, chooseFixedFrame } from "./common";
import { MacroBot, MacroBotBuildOptions, MacroBotSelection } from "./types";

export type GreedyValueMode = "immediate" | "income-normalized";

export interface GreedyMacroBotOptions extends MacroBotBuildOptions {
  /** The default preserves the frozen AI-6 baseline exactly. */
  valueMode?: GreedyValueMode;
}

export interface GreedyEvaluation {
  terminal: boolean;
  value: number;
  sourceValue: number;
  immediateChange: number;
  scoreMargin: number;
  resourceMargin: number;
}

function playerResourceValue(engine: Engine, seat: Player): number {
  const player = engine.player(seat);
  const data = player.data;
  const brainstone = data.brainstone === PowerArea.Area3 ? 0.8 : data.brainstone === PowerArea.Area2 ? 0.35 : 0;
  return (
    data.credits * 0.2 +
    data.ores * 0.75 +
    data.knowledge * 0.9 +
    data.qics * 1.1 +
    data.power.area1 * 0.04 +
    data.power.area2 * 0.1 +
    data.power.area3 * 0.25 +
    brainstone +
    projectedEndgameResourceVictoryPoints(player) * 0.2
  );
}

function remainingIncomePhases(engine: Engine): number {
  if (engine.phase === Phase.EndGame) {
    return 0;
  }
  if (engine.round <= 0) {
    return 6;
  }
  if (engine.phase === Phase.RoundStart || engine.phase === Phase.RoundIncome) {
    return Math.max(7 - engine.round, 0);
  }
  return Math.max(6 - engine.round, 0);
}

function playerProjectedIncomeValue(engine: Engine, seat: Player): number {
  const player = engine.player(seat);
  const phases = remainingIncomePhases(engine);
  return (
    player.resourceIncome(Resource.Credit) * 0.2 * phases +
    player.resourceIncome(Resource.Ore) * 0.75 * phases +
    player.resourceIncome(Resource.Knowledge) * 0.9 * phases +
    player.resourceIncome(Resource.Qic) * 1.1 * phases +
    player.resourceIncome(Resource.ChargePower) * 0.12 * phases +
    player.resourceIncome(Resource.GainToken) * 0.1 * phases +
    player.resourceIncome(Resource.GainTokenArea3) * 0.25 * phases
  );
}

export function greedyStateValue(engine: Engine, mode: GreedyValueMode = "immediate"): number {
  if (engine.ended) {
    return terminalUtility(engine);
  }
  const scoreMargin =
    engine.player(Player.Player1).data.victoryPoints - engine.player(Player.Player2).data.victoryPoints;
  const projectedIncomeMargin =
    mode === "income-normalized"
      ? playerProjectedIncomeValue(engine, Player.Player1) - playerProjectedIncomeValue(engine, Player.Player2)
      : 0;
  return (
    scoreMargin +
    playerResourceValue(engine, Player.Player1) -
    playerResourceValue(engine, Player.Player2) +
    projectedIncomeMargin
  );
}

function greedyEvaluation(source: Engine, destination: Engine, mode: GreedyValueMode): GreedyEvaluation {
  const sourceValue = greedyStateValue(source, mode);
  const value = greedyStateValue(destination, mode);
  const scoreMargin =
    destination.player(Player.Player1).data.victoryPoints - destination.player(Player.Player2).data.victoryPoints;
  const resourceMargin =
    playerResourceValue(destination, Player.Player1) - playerResourceValue(destination, Player.Player2);
  return {
    terminal: destination.ended,
    value,
    sourceValue,
    immediateChange: value - sourceValue,
    scoreMargin,
    resourceMargin,
  };
}

/** One-ply immediate score/resource baseline; it performs no search or opponent modeling. */
export class GreedyMacroBot implements MacroBot<GreedyEvaluation> {
  readonly name: string;

  constructor(private readonly options: GreedyMacroBotOptions = {}) {
    this.name = options.valueMode === "income-normalized" ? "income-normalized-greedy-macro" : "greedy-macro";
  }

  select(engine: Engine): MacroBotSelection<GreedyEvaluation> {
    const macroSet = buildBotMacroSet(engine, this.options.macroBuildOptions);
    const candidates = macroSet.macros.map((macro) => {
      const destination = applyMacroHostStyle(engine, macro);
      const evaluation = greedyEvaluation(engine, destination, this.options.valueMode ?? "immediate");
      return { macro, destination, evaluation, value: evaluation.value };
    });
    const best = chooseFixedFrame(macroSet.actor, candidates);
    return {
      bot: this.name,
      macroSet,
      macro: best.macro,
      evaluation: best.evaluation,
    };
  }
}
