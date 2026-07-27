// The renju face's analysis meter, the exact counterpart of logic/chess-evaluation.ts: turn the
// current position into a single white-vs-black percentage plus a spoken description, and keep it
// up to date as the shared board changes.
//
// The two differences from the chess side, both forced by there being no third-party gomoku engine:
//   * The search is ours (logic/renju-engine.ts) rather than Stockfish's.
//   * It runs on the main thread in slices instead of inside a Web Worker. RenjuEvaluator drives
//     IterativeSearch one root move at a time and hands control back to the browser as soon as a
//     slice has used its few milliseconds, so a real search still never blocks the UI.
//
// The bar stays WHITE-relative, exactly like the chess face's, so the two drawer faces read
// identically - even though black is the side that opens in renju.

import { BLACK, IterativeSearch, Player, Position, SearchOptions, WHITE, toCells, WIN_SCORE } from "./renju-engine";

export interface RenjuEvaluation {
  /** Static score from BLACK's point of view, or a proven-win score. */
  score: number;
  /** Plies to the forced win when one has been proven, else null. */
  winInPlies: number | null;
  winner: Player | null;
  /** Completed search depth in plies. */
  depth: number;
  whitePercent: number;
}

/**
 * How much score separation the meter treats as "completely winning". Chess borrows Lichess's
 * centipawn curve; renju scores are in this engine's own pattern units, so the curve is anchored
 * here instead: roughly one extra open three (~540) reads as a visible edge, and a clear extra four
 * (~3600) reads as close to decisive.
 */
const ADVANTAGE_SCALE = 1500;

/** Search settings for the meter: strong enough to be honest, cheap enough to slice. */
export const EVALUATION_OPTIONS: SearchOptions = {
  maxDepth: 6,
  nodeBudget: 25_000,
  vcfDepth: 10,
  rootWidth: 12,
  innerWidth: 8,
};

/** Milliseconds of search per slice before handing the thread back to the browser. */
const SLICE_MS = 8;

export function whiteEvaluationPercent(score: number, winner: Player | null): number {
  if (winner !== null) {
    return winner === WHITE ? 100 : 0;
  }
  // Same logistic shape the chess meter uses, so both faces move the same way; only the scale
  // differs. Keep a sliver of each colour visible so the thin horizontal meter stays legible.
  const blackPercent = 100 / (1 + Math.exp(-score / ADVANTAGE_SCALE));
  return Math.max(2, Math.min(98, 100 - blackPercent));
}

export function evaluationDescription(evaluation: RenjuEvaluation | null, unavailable = false): string {
  if (unavailable) {
    return "Renju evaluation unavailable";
  }
  if (!evaluation) {
    return "Analysing this position";
  }
  if (evaluation.winner !== null) {
    const side = evaluation.winner === BLACK ? "Black" : "White";
    if (!evaluation.winInPlies) {
      return `${side} has five in a row`;
    }
    const stones = Math.ceil(evaluation.winInPlies / 2);
    return `${side} wins in ${stones} move${stones === 1 ? "" : "s"}`;
  }
  const side = evaluation.score > 0 ? "Black" : "White";
  const magnitude = Math.abs(evaluation.score);
  const depth = ` at depth ${evaluation.depth}`;
  if (magnitude < 120) {
    return `Even position${depth}`;
  }
  if (magnitude < 600) {
    return `${side} is slightly better${depth}`;
  }
  if (magnitude < 3000) {
    return `${side} is clearly better${depth}`;
  }
  return `${side} is winning${depth}`;
}

function toEvaluation(result: {
  score: number;
  depth: number;
  winner: Player | null;
  winInPlies: number | null;
}): RenjuEvaluation {
  return {
    score: result.score,
    depth: result.depth,
    winner: result.winner,
    winInPlies: result.winInPlies,
    whitePercent: whiteEvaluationPercent(result.score, result.winner),
  };
}

/** Decides who is to move from the position itself: black opens, so level stone counts mean black. */
export function sideToMoveFor(board: string): Player {
  let black = 0;
  let white = 0;
  for (let index = 0; index < board.length; index++) {
    const cell = board.charAt(index);
    if (cell === "b") {
      black++;
    } else if (cell === "w") {
      white++;
    }
  }
  return black === white ? BLACK : WHITE;
}

/** Injectable so tests can run the whole controller synchronously. */
export type SliceScheduler = (run: () => void) => void;

const defaultScheduler: SliceScheduler = (run) => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => run());
    return;
  }
  setTimeout(run, 0);
};

/**
 * Keeps one board's evaluation current.
 *
 * Only the newest requested position is ever analysed: asking for a new one abandons whatever the
 * old search had left to do, exactly like the chess evaluator stopping Stockfish mid-search. Every
 * completed depth is reported as it lands, so the meter settles in rather than jumping once at the
 * end.
 */
export class RenjuEvaluator {
  private search: IterativeSearch | null = null;
  private analysedBoard: string | null = null;
  private scheduled = false;
  private destroyed = false;

  constructor(
    private readonly onEvaluation: (evaluation: RenjuEvaluation) => void,
    private readonly options: SearchOptions = EVALUATION_OPTIONS,
    private readonly schedule: SliceScheduler = defaultScheduler,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Starts (or restarts) analysis of `board`. Re-analysing the same position is a no-op. */
  analyze(board: string) {
    if (this.destroyed || board === this.analysedBoard) {
      return;
    }
    this.analysedBoard = board;
    this.search = new IterativeSearch(new Position(toCells(board)), sideToMoveFor(board), this.options);
    this.report();
    this.queueSlice();
  }

  /** Abandons the current search without reporting anything further. */
  cancel() {
    this.search = null;
    this.analysedBoard = null;
  }

  destroy() {
    this.destroyed = true;
    this.cancel();
  }

  private queueSlice() {
    if (this.scheduled || this.destroyed || !this.search || this.search.finished) {
      return;
    }
    this.scheduled = true;
    this.schedule(() => this.runSlice());
  }

  private runSlice() {
    this.scheduled = false;
    const search = this.search;
    if (this.destroyed || !search || search.finished) {
      return;
    }
    const deadline = this.now() + SLICE_MS;
    let more = true;
    do {
      more = search.step();
    } while (more && this.now() < deadline);
    // A search abandoned mid-slice (a new position arrived) must not overwrite the newer one.
    if (this.search !== search) {
      return;
    }
    this.report();
    this.queueSlice();
  }

  private report() {
    if (this.search) {
      this.onEvaluation(toEvaluation(this.search.result));
    }
  }
}

/** The evaluation of a position that is already over, for the component's win/draw shortcut. */
export function decidedEvaluation(winner: Player | null): RenjuEvaluation {
  return {
    score: winner === null ? 0 : winner === BLACK ? WIN_SCORE : -WIN_SCORE,
    depth: 0,
    winner,
    winInPlies: winner === null ? null : 0,
    whitePercent: winner === null ? 50 : whiteEvaluationPercent(0, winner),
  };
}
