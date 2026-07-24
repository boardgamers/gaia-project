import { expect } from "chai";
import {
  ChessEvaluation,
  EvaluationWorker,
  StockfishEvaluator,
  evaluationDescription,
  evaluationLabel,
  parseStockfishEvaluation,
  whiteEvaluationPercent,
} from "./chess-evaluation";
import { START_FEN } from "./chess";

class FakeWorker implements EvaluationWorker {
  sent: string[] = [];
  terminated = false;
  private listeners: Record<string, Array<(event: any) => void>> = {};

  postMessage(command: string) {
    this.sent.push(command);
  }

  terminate() {
    this.terminated = true;
  }

  addEventListener(type: "message" | "error", listener: (event: any) => void) {
    (this.listeners[type] ?? (this.listeners[type] = [])).push(listener);
  }

  removeEventListener(type: "message" | "error", listener: (event: any) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((candidate) => candidate !== listener);
  }

  emit(line: string) {
    for (const listener of this.listeners.message ?? []) {
      listener({ data: line });
    }
  }
}

describe("chess evaluation", () => {
  it("normalizes UCI scores to White and maps them to a bounded horizontal share", () => {
    const white = parseStockfishEvaluation("info depth 12 score cp 80 nodes 10", START_FEN);
    expect(white).to.include({ kind: "cp", value: 80, depth: 12 });
    expect((white as ChessEvaluation).whitePercent).to.be.greaterThan(50);

    const blackToMove = START_FEN.replace(" w ", " b ");
    const black = parseStockfishEvaluation("info depth 14 score cp 125 nodes 10", blackToMove);
    expect(black).to.include({ kind: "cp", value: -125, depth: 14 });
    expect((black as ChessEvaluation).whitePercent).to.be.lessThan(50);

    expect(whiteEvaluationPercent("cp", 5000)).to.be.within(97, 98);
    expect(whiteEvaluationPercent("cp", -5000)).to.be.within(2, 3);
    expect(whiteEvaluationPercent("mate", 3)).to.equal(100);
    expect(whiteEvaluationPercent("mate", -2)).to.equal(0);
  });

  it("formats compact score labels and accessible descriptions", () => {
    const cp: ChessEvaluation = { kind: "cp", value: 34, depth: 11, whitePercent: 53 };
    const mate: ChessEvaluation = { kind: "mate", value: -3, depth: 15, whitePercent: 0 };
    expect(evaluationLabel(cp)).to.equal("+0.3");
    expect(evaluationDescription(cp)).to.equal("White is ahead by 0.3 at depth 11");
    expect(evaluationLabel(mate)).to.equal("-M3");
    expect(evaluationDescription(mate)).to.equal("Black has mate in 3");
    expect(evaluationDescription(null, true)).to.equal("Stockfish evaluation unavailable");
  });

  it("runs one worker search at a time and drops stale shared-game output", () => {
    const worker = new FakeWorker();
    const evaluations: ChessEvaluation[] = [];
    const evaluator = new StockfishEvaluator(
      (evaluation) => evaluations.push(evaluation),
      () => undefined,
      () => worker
    );

    expect(worker.sent).to.deep.equal(["uci"]);
    evaluator.analyze(START_FEN);
    worker.emit("uciok");
    expect(worker.sent.slice(-2)).to.deep.equal(["setoption name Hash value 8", "isready"]);
    worker.emit("readyok");
    expect(worker.sent.slice(-2)).to.deep.equal([`position fen ${START_FEN}`, "go movetime 500"]);

    worker.emit("info depth 6 score cp 21 nodes 100");
    expect(evaluations.map((evaluation) => evaluation.value)).to.deep.equal([21]);

    const blackToMove = START_FEN.replace(" w ", " b ");
    evaluator.analyze(blackToMove);
    expect(worker.sent[worker.sent.length - 1]).to.equal("stop");
    worker.emit("info depth 10 score cp 90 nodes 200");
    expect(evaluations).to.have.length(1);
    worker.emit("bestmove e2e4");
    expect(worker.sent.slice(-2)).to.deep.equal([`position fen ${blackToMove}`, "go movetime 500"]);
    worker.emit("info depth 8 score cp 90 nodes 100");
    expect(evaluations[1].value).to.equal(-90);

    evaluator.destroy();
    expect(worker.terminated).to.equal(true);
  });
});
