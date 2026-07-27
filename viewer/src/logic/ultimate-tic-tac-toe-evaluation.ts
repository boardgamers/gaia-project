// A small, fully offline search for the Ultimate tic-tac-toe advantage strip. X-positive scores
// are converted into a stable X-vs-O percentage; no position or analysis leaves the browser.

import {
  MiniResolution,
  ULTIMATE_WIN_LINES,
  UltimateMark,
  cellWithinMini,
  legalUltimateMoves,
  markAt,
  miniBoardResolution,
  placeUltimateMark,
  turnForUltimateBoard,
  ultimateBoardStatus,
  ultimateCellIndex,
} from "./ultimate-tic-tac-toe";

export interface UltimateEvaluation {
  score: number;
  depth: number;
  nodes: number;
  winner: UltimateMark | null;
  xPercent: number;
}

export interface UltimateEvaluationOptions {
  maxDepth: number;
  nodeBudget: number;
}

export const ULTIMATE_EVALUATION_OPTIONS: UltimateEvaluationOptions = {
  maxDepth: 5,
  nodeBudget: 20_000,
};

const WIN_SCORE = 100_000;
const ADVANTAGE_SCALE = 900;
const LOCAL_LINE_VALUE = [0, 4, 55];
const META_LINE_VALUE = [0, 140, 2_600];
const CELL_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];
const META_WEIGHT = [1.12, 1, 1.12, 1, 1.28, 1, 1.12, 1, 1.12];

function terminalScore(winner: UltimateMark | null, ply: number): number {
  if (winner === "x") {
    return WIN_SCORE - ply;
  }
  if (winner === "o") {
    return -WIN_SCORE + ply;
  }
  return 0;
}

function linePotential(values: Array<UltimateMark | MiniResolution>, xValue: number[], oValue: number[]): number {
  let score = 0;
  for (const line of ULTIMATE_WIN_LINES) {
    let x = 0;
    let o = 0;
    let blocked = false;
    for (const index of line) {
      const value = values[index];
      if (value === "x") {
        x++;
      } else if (value === "o") {
        o++;
      } else if (value === "draw") {
        blocked = true;
      }
    }
    if (!blocked && o === 0 && x < 3) {
      score += xValue[x] ?? 0;
    }
    if (!blocked && x === 0 && o < 3) {
      score -= oValue[o] ?? 0;
    }
  }
  return score;
}

/** Fast positional score from X's point of view. */
export function staticUltimateEvaluation(board: string, lastMove: number | null): number {
  const status = ultimateBoardStatus(board);
  if (status.over) {
    return terminalScore(status.winner, 0);
  }

  let score = linePotential(status.resolutions, META_LINE_VALUE, META_LINE_VALUE);
  for (let miniBoard = 0; miniBoard < 9; miniBoard++) {
    const resolution = status.resolutions[miniBoard];
    if (resolution === "x") {
      score += 420 * META_WEIGHT[miniBoard];
      continue;
    }
    if (resolution === "o") {
      score -= 420 * META_WEIGHT[miniBoard];
      continue;
    }
    if (resolution === "draw") {
      continue;
    }
    const cells = Array.from({ length: 9 }, (_, cell) => markAt(board, ultimateCellIndex(miniBoard, cell)));
    score += linePotential(cells, LOCAL_LINE_VALUE, LOCAL_LINE_VALUE) * META_WEIGHT[miniBoard];
  }

  // Initiative in the forced board matters: an immediate local win is more valuable when the next
  // player is actually routed there than when it is merely a future possibility.
  if (lastMove !== null) {
    const forced = cellWithinMini(lastMove);
    if (miniBoardResolution(board, forced) === null) {
      score += turnForUltimateBoard(board) === "x" ? 8 : -8;
    }
  }
  return Math.round(score);
}

export function xEvaluationPercent(score: number, winner: UltimateMark | null): number {
  if (winner) {
    return winner === "x" ? 100 : 0;
  }
  const percent = 100 / (1 + Math.exp(-score / ADVANTAGE_SCALE));
  return Math.max(2, Math.min(98, percent));
}

export function ultimateEvaluationDescription(evaluation: UltimateEvaluation | null): string {
  if (!evaluation) {
    return "Analysing this position";
  }
  if (evaluation.winner) {
    return `${evaluation.winner.toUpperCase()} has won`;
  }
  const magnitude = Math.abs(evaluation.score);
  if (magnitude < 70) {
    return `Even position at depth ${evaluation.depth}`;
  }
  const side = evaluation.score > 0 ? "X" : "O";
  if (magnitude < 350) {
    return `${side} is slightly better at depth ${evaluation.depth}`;
  }
  if (magnitude < 1_800) {
    return `${side} is clearly better at depth ${evaluation.depth}`;
  }
  return `${side} is winning at depth ${evaluation.depth}`;
}

interface SearchContext {
  nodes: number;
  nodeBudget: number;
}

interface SearchResult {
  score: number;
  complete: boolean;
}

function orderedMoves(board: string, lastMove: number | null): number[] {
  const moves = legalUltimateMoves(board, lastMove);
  return moves.sort((a, b) => {
    const aCell = CELL_ORDER.indexOf(cellWithinMini(a));
    const bCell = CELL_ORDER.indexOf(cellWithinMini(b));
    return aCell - bCell;
  });
}

function alphaBeta(
  board: string,
  lastMove: number | null,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  context: SearchContext
): SearchResult {
  context.nodes++;
  const status = ultimateBoardStatus(board);
  if (status.over) {
    return { score: terminalScore(status.winner, ply), complete: true };
  }
  if (depth === 0) {
    return { score: staticUltimateEvaluation(board, lastMove), complete: true };
  }
  if (context.nodes >= context.nodeBudget) {
    return { score: staticUltimateEvaluation(board, lastMove), complete: false };
  }

  const maximizing = turnForUltimateBoard(board) === "x";
  let best = maximizing ? -Infinity : Infinity;
  for (const move of orderedMoves(board, lastMove)) {
    if (context.nodes >= context.nodeBudget) {
      return { score: Number.isFinite(best) ? best : staticUltimateEvaluation(board, lastMove), complete: false };
    }
    const next = placeUltimateMark(board, lastMove, move);
    if (!next) {
      continue;
    }
    const child = alphaBeta(next, move, depth - 1, alpha, beta, ply + 1, context);
    if (!child.complete) {
      return { score: Number.isFinite(best) ? best : child.score, complete: false };
    }
    if (maximizing) {
      best = Math.max(best, child.score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, child.score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) {
      break;
    }
  }
  return {
    score: Number.isFinite(best) ? best : staticUltimateEvaluation(board, lastMove),
    complete: true,
  };
}

export function evaluateUltimatePosition(
  board: string,
  lastMove: number | null,
  options: UltimateEvaluationOptions = ULTIMATE_EVALUATION_OPTIONS
): UltimateEvaluation {
  const status = ultimateBoardStatus(board);
  if (status.over) {
    const score = terminalScore(status.winner, 0);
    return { score, depth: 0, nodes: 0, winner: status.winner, xPercent: xEvaluationPercent(score, status.winner) };
  }

  const context: SearchContext = { nodes: 0, nodeBudget: options.nodeBudget };
  let score = staticUltimateEvaluation(board, lastMove);
  let completedDepth = 0;
  for (let depth = 1; depth <= options.maxDepth && context.nodes < context.nodeBudget; depth++) {
    const result = alphaBeta(board, lastMove, depth, -Infinity, Infinity, 0, context);
    if (!result.complete) {
      break;
    }
    score = result.score;
    completedDepth = depth;
  }
  return {
    score,
    depth: completedDepth,
    nodes: context.nodes,
    winner: null,
    xPercent: xEvaluationPercent(score, null),
  };
}

type EvaluationScheduler = (run: () => void) => void;

const defaultScheduler: EvaluationScheduler = (run) => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => run());
  } else {
    setTimeout(run, 0);
  }
};

/**
 * Reports the cheap static reading immediately, then replaces it with a bounded search result on
 * the next frame. A token cancels stale work when a remote/local move lands before analysis starts.
 */
export class UltimateEvaluator {
  private token = 0;
  private destroyed = false;
  private signature = "";

  constructor(
    private readonly onEvaluation: (evaluation: UltimateEvaluation) => void,
    private readonly options: UltimateEvaluationOptions = ULTIMATE_EVALUATION_OPTIONS,
    private readonly schedule: EvaluationScheduler = defaultScheduler
  ) {}

  analyze(board: string, lastMove: number | null) {
    const signature = `${board}:${lastMove ?? "-"}`;
    if (this.destroyed || signature === this.signature) {
      return;
    }
    this.signature = signature;
    const token = ++this.token;
    const status = ultimateBoardStatus(board);
    const staticScore = status.over ? terminalScore(status.winner, 0) : staticUltimateEvaluation(board, lastMove);
    this.onEvaluation({
      score: staticScore,
      depth: 0,
      nodes: 0,
      winner: status.winner,
      xPercent: xEvaluationPercent(staticScore, status.winner),
    });
    if (status.over) {
      return;
    }
    this.schedule(() => {
      if (this.destroyed || token !== this.token) {
        return;
      }
      this.onEvaluation(evaluateUltimatePosition(board, lastMove, this.options));
    });
  }

  destroy() {
    this.destroyed = true;
    this.token++;
  }
}
