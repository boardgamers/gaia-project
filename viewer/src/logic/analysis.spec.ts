import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { AnalysisEntry, loadAnalysisLine, replayAnalysisLine, saveAnalysisLine } from "./analysis";

// Same fixture as premove-preview.spec.ts: after these moves it's terrans' (seat 0) turn.
const SETUP_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
  "nevlas build m 0x-4",
  "terrans build m -4x-1",
  "nevlas booster booster7",
  "terrans booster booster3",
];

describe("replayAnalysisLine", () => {
  it("replays a legal line onto a fresh clone of the origin", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans up nav." }];
    const { engine, applied } = replayAnalysisLine(origin, entries);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("stops at the first entry that has gone illegal, keeping the valid prefix", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans build m 99x99." },
      { kind: "move", move: "nevlas up nav." },
    ];
    const { engine, applied } = replayAnalysisLine(origin, entries);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("leaves the original engine untouched", () => {
    const origin = new Engine(SETUP_MOVES);
    const before = JSON.stringify(origin);
    replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }]);
    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("returns the origin itself, unmodified, for an empty line", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine, applied } = replayAnalysisLine(origin, []);
    expect(applied).to.equal(0);
    expect(engine.moveHistory).to.deep.equal(origin.moveHistory);
  });
});

describe("analysis line persistence", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a saved line for the same seat", () => {
    const line = {
      entries: [{ kind: "move", move: "terrans up nav." }] as AnalysisEntry[],
      baseRound: 1,
      baseMoveCount: 9,
    };
    saveAnalysisLine(0, line);
    expect(loadAnalysisLine(0)).to.deep.equal(line);
  });

  it("keeps different seats' lines separate", () => {
    saveAnalysisLine(0, { entries: [], baseRound: 1, baseMoveCount: 9 });
    expect(loadAnalysisLine(1)).to.equal(null);
  });

  it("returns null when nothing is stored", () => {
    expect(loadAnalysisLine(0)).to.equal(null);
  });
});
