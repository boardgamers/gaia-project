import Engine from "../../engine";
import { rngFromString } from "../../fuzz/rng";
import { buildBotMacroSet } from "./common";
import { MacroBot, MacroBotBuildOptions, MacroBotSelection } from "./types";

export interface RandomMacroEvaluation {
  randomIndex: number;
  macroCount: number;
}

/** Correctness/smoke baseline: uniform sampling over the already-committed Phase 1.4 macros. */
export class RandomMacroBot implements MacroBot<RandomMacroEvaluation> {
  readonly name = "random-macro";
  private readonly rng: () => number;

  constructor(
    seed: string,
    private readonly options: MacroBotBuildOptions = {}
  ) {
    this.rng = rngFromString(seed);
  }

  select(engine: Engine): MacroBotSelection<RandomMacroEvaluation> {
    const macroSet = buildBotMacroSet(engine, this.options.macroBuildOptions);
    const randomIndex = Math.floor(this.rng() * macroSet.macros.length);
    return {
      bot: this.name,
      macroSet,
      macro: macroSet.macros[randomIndex],
      evaluation: { randomIndex, macroCount: macroSet.macros.length },
    };
  }
}
