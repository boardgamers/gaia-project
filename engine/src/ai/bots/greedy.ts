import Engine from "../../engine";
import { Player, PowerArea } from "../../enums";
import { projectedEndgameResourceVictoryPoints, terminalUtility } from "../evaluation";
import { applyMacroHostStyle, buildBotMacroSet, chooseFixedFrame } from "./common";
import { MacroBot, MacroBotBuildOptions, MacroBotSelection } from "./types";

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

export function greedyStateValue(engine: Engine): number {
  if (engine.ended) {
    return terminalUtility(engine);
  }
  const scoreMargin =
    engine.player(Player.Player1).data.victoryPoints - engine.player(Player.Player2).data.victoryPoints;
  return scoreMargin + playerResourceValue(engine, Player.Player1) - playerResourceValue(engine, Player.Player2);
}

function greedyEvaluation(source: Engine, destination: Engine): GreedyEvaluation {
  const sourceValue = greedyStateValue(source);
  const value = greedyStateValue(destination);
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
  readonly name = "greedy-macro";

  constructor(private readonly options: MacroBotBuildOptions = {}) {}

  select(engine: Engine): MacroBotSelection<GreedyEvaluation> {
    const macroSet = buildBotMacroSet(engine, this.options.macroBuildOptions);
    const candidates = macroSet.macros.map((macro) => {
      const destination = applyMacroHostStyle(engine, macro);
      const evaluation = greedyEvaluation(engine, destination);
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
