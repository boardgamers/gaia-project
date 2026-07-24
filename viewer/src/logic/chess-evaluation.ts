export type EvaluationKind = "cp" | "mate";

export interface ChessEvaluation {
  kind: EvaluationKind;
  /** White-relative centipawns, or signed moves-to-mate for a mate score. */
  value: number;
  depth: number;
  whitePercent: number;
}

export interface EvaluationWorker {
  postMessage(command: string): void;
  terminate(): void;
  addEventListener(type: "message" | "error", listener: (event: any) => void): void;
  removeEventListener(type: "message" | "error", listener: (event: any) => void): void;
}

export type EvaluationWorkerFactory = () => EvaluationWorker | null;

const WINNING_CHANCES_SLOPE = 0.00368208;
const SEARCH_TIME_MS = 500;

function workerUrl(): string {
  const base = process.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : base + "/"}stockfish/stockfish.wasm.js`;
}

function defaultWorkerFactory(): EvaluationWorker | null {
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
    return null;
  }
  try {
    return new Worker(workerUrl()) as EvaluationWorker;
  } catch (_error) {
    return null;
  }
}

export function whiteEvaluationPercent(kind: EvaluationKind, value: number): number {
  if (kind === "mate") {
    return value === 0 ? 50 : value > 0 ? 100 : 0;
  }
  // This is the same logistic shape Lichess uses to turn centipawns into winning chances. Keep a
  // sliver of each colour visible for non-mate scores so the horizontal meter remains legible.
  const bounded = Math.max(-1000, Math.min(1000, value));
  const percent = 100 / (1 + Math.exp(-WINNING_CHANCES_SLOPE * bounded));
  return Math.max(2, Math.min(98, percent));
}

export function parseStockfishEvaluation(line: string, fen: string): ChessEvaluation | null {
  if (line.indexOf(" lowerbound") !== -1 || line.indexOf(" upperbound") !== -1) {
    return null;
  }
  const depthMatch = /\bdepth (\d+)/.exec(line);
  const scoreMatch = /\bscore (cp|mate) (-?\d+)/.exec(line);
  if (!depthMatch || !scoreMatch) {
    return null;
  }
  const kind = scoreMatch[1] as EvaluationKind;
  const rawValue = Number(scoreMatch[2]);
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  // UCI scores are from the side-to-move point of view. The bar and label deliberately stay
  // White-relative even when a Black player has the board rotated.
  const sideToMove = fen.trim().split(/\s+/)[1];
  const value = sideToMove === "b" ? -rawValue : rawValue;
  return {
    kind,
    value,
    depth: Number(depthMatch[1]),
    whitePercent: whiteEvaluationPercent(kind, value),
  };
}

export function evaluationLabel(evaluation: ChessEvaluation | null): string {
  if (!evaluation) {
    return "…";
  }
  if (evaluation.kind === "mate") {
    if (evaluation.value === 0) {
      return "Mate";
    }
    return `${evaluation.value > 0 ? "" : "-"}M${Math.abs(evaluation.value)}`;
  }
  const pawns = evaluation.value / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

export function evaluationDescription(evaluation: ChessEvaluation | null, unavailable = false): string {
  if (unavailable) {
    return "Stockfish evaluation unavailable";
  }
  if (!evaluation) {
    return "Stockfish is evaluating this position";
  }
  if (evaluation.kind === "mate") {
    if (evaluation.value === 0) {
      return "Forced mate";
    }
    const side = evaluation.value > 0 ? "White" : "Black";
    return `${side} has mate in ${Math.abs(evaluation.value)}`;
  }
  if (evaluation.value === 0) {
    return `Even position at depth ${evaluation.depth}`;
  }
  const side = evaluation.value > 0 ? "White" : "Black";
  return `${side} is ahead by ${Math.abs(evaluation.value / 100).toFixed(1)} at depth ${evaluation.depth}`;
}

/**
 * Minimal UCI controller for the browser Stockfish worker.
 *
 * Only the newest requested FEN is analyzed. If a shared-game update arrives while Stockfish is
 * thinking, the old search is stopped and its remaining output is ignored before the new search
 * begins.
 */
export class StockfishEvaluator {
  private worker: EvaluationWorker | null;
  private desiredFen: string | null = null;
  private activeFen: string | null = null;
  private ready = false;
  private searching = false;
  private stopRequested = false;
  private latestDepth = -1;
  private destroyed = false;

  private readonly onMessage: (event: any) => void;
  private readonly onWorkerError: () => void;

  constructor(
    private readonly onEvaluation: (evaluation: ChessEvaluation) => void,
    private readonly onUnavailable: () => void = () => undefined,
    workerFactory: EvaluationWorkerFactory = defaultWorkerFactory
  ) {
    this.onMessage = (event: any) => this.handleLine(String(event.data ?? event));
    this.onWorkerError = () => this.fail();
    this.worker = workerFactory();
    if (!this.worker) {
      this.onUnavailable();
      return;
    }
    this.worker.addEventListener("message", this.onMessage);
    this.worker.addEventListener("error", this.onWorkerError);
    this.send("uci");
  }

  analyze(fen: string) {
    if (this.destroyed || !this.worker || fen === this.desiredFen) {
      return;
    }
    this.desiredFen = fen;
    if (!this.ready) {
      return;
    }
    if (this.searching) {
      if (!this.stopRequested) {
        this.stopRequested = true;
        this.send("stop");
      }
      return;
    }
    this.startLatestSearch();
  }

  cancel() {
    this.desiredFen = null;
    if (this.searching && !this.stopRequested) {
      this.stopRequested = true;
      this.send("stop");
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.worker) {
      this.worker.removeEventListener("message", this.onMessage);
      this.worker.removeEventListener("error", this.onWorkerError);
      this.worker.terminate();
      this.worker = null;
    }
  }

  private handleLine(line: string) {
    if (this.destroyed || !this.worker) {
      return;
    }
    if (line === "uciok") {
      this.send("setoption name Hash value 8");
      this.send("isready");
      return;
    }
    if (line === "readyok") {
      this.ready = true;
      this.startLatestSearch();
      return;
    }
    if (line.indexOf("bestmove ") === 0) {
      this.searching = false;
      this.stopRequested = false;
      if (this.desiredFen !== this.activeFen) {
        this.startLatestSearch();
      }
      return;
    }
    if (!this.searching || !this.activeFen || this.activeFen !== this.desiredFen) {
      return;
    }
    const evaluation = parseStockfishEvaluation(line, this.activeFen);
    if (evaluation && evaluation.depth >= this.latestDepth) {
      this.latestDepth = evaluation.depth;
      this.onEvaluation(evaluation);
    }
  }

  private startLatestSearch() {
    if (!this.worker || !this.ready || this.searching || !this.desiredFen) {
      return;
    }
    this.activeFen = this.desiredFen;
    this.latestDepth = -1;
    this.searching = true;
    this.stopRequested = false;
    this.send(`position fen ${this.activeFen}`);
    this.send(`go movetime ${SEARCH_TIME_MS}`);
  }

  private send(command: string) {
    this.worker?.postMessage(command);
  }

  private fail() {
    if (this.destroyed) {
      return;
    }
    this.onUnavailable();
    this.destroy();
  }
}
