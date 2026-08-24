import Engine from "../../engine";
import { CommittedTurnMacro, CommittedTurnMacroBuildOptions, CommittedTurnMacroSet } from "../actions/turn-builder";

export interface MacroBotBuildOptions {
  /**
   * Phase 1.3 conversion integration is exact and uncapped when enabled. Baseline self-play
   * defaults it off because the locked rich wallet has a measured 130,532 seed-pair branch set;
   * this is a play-policy choice, not a depth, sequence, time, or beam cap in either planner.
   */
  macroBuildOptions?: CommittedTurnMacroBuildOptions;
}

export interface MacroBotSelection<T = unknown> {
  bot: string;
  macroSet: CommittedTurnMacroSet;
  macro: CommittedTurnMacro;
  evaluation: T;
}

export interface MacroBot<T = unknown> {
  readonly name: string;
  select(engine: Engine): MacroBotSelection<T>;
}
