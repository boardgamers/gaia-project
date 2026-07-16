import Engine from "../../engine";
import { evaluateHeuristic, HeuristicEvaluationOptions, HeuristicEvaluationReport } from "../evaluation";
import { applyMacroHostStyle, buildBotMacroSet, chooseFixedFrame } from "./common";
import { MacroBot, MacroBotBuildOptions, MacroBotSelection } from "./types";

export interface HeuristicMacroBotOptions extends MacroBotBuildOptions {
  evaluation?: Omit<HeuristicEvaluationOptions, "transition">;
}

/** Deterministic, inspectable one-ply heuristic baseline. No tree or lookahead is constructed. */
export class HeuristicMacroBot implements MacroBot<HeuristicEvaluationReport> {
  readonly name = "heuristic-macro";

  constructor(private readonly options: HeuristicMacroBotOptions = {}) {}

  select(engine: Engine): MacroBotSelection<HeuristicEvaluationReport> {
    const macroSet = buildBotMacroSet(engine, this.options.macroBuildOptions);
    const candidates = macroSet.macros.map((macro) => {
      const destination = applyMacroHostStyle(engine, macro);
      const evaluation = evaluateHeuristic(destination, {
        ...this.options.evaluation,
        transition: { source: engine, macro },
      });
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
