import Engine, { EngineOptions } from "../../engine";

/**
 * FUZZER_PLAN.md §3, oracle-traceability rule: every oracle carries, in code, a citation to its
 * rule source (`RULES_CLARIFICATIONS.md §x` and/or `rulebook-v1.0.txt` section), and the oracle's
 * assertion text repeats the rule in one sentence. An oracle without a citation does not get merged.
 */
export interface OracleContext {
  engine: Engine;
  /** Raw committed move lines (starting with the init line) — replaying these reproduces `engine`. */
  moves: string[];
  /** The pristine (never engine-mutated) options the game was started from. */
  options: EngineOptions;
  players: number;
  gameSeed: string;
  lostFleet: boolean;
}

export interface OracleFailure {
  oracle: string;
  citation: string;
  message: string;
}

export interface Oracle {
  name: string;
  /** Rule source, e.g. "RULES_CLARIFICATIONS.md §C5" or "FUZZER_PLAN.md §3 tier-1 (structural)". */
  citation: string;
  /** Run after every committed line. Return failure messages (empty = pass). */
  afterLine?(ctx: OracleContext): string[];
  /** Run once when the game reaches EndGame (or is aborted at the move cap). */
  atEnd?(ctx: OracleContext): string[];
}

export function failuresOf(oracle: Oracle, messages: string[]): OracleFailure[] {
  return messages.map((message) => ({ oracle: oracle.name, citation: oracle.citation, message }));
}
