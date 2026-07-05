import { expect } from "chai";
import { EngineLike, resolvePremoveQueue } from "./premove-resolver";

// Fully generic tests (no real engine needed - the resolver is engine-agnostic, see its own doc
// comment) exercising the mode-branching decision logic in isolation, per PREMOVE_PLAN.md §10.8.
// `behavior` scripts what each move line does when applied to a fresh clone: "ok" completes a turn,
// "incomplete" applies but leaves newTurn false, anything else (including omission) throws.
function fakeCloneFactory(behavior: Record<string, "ok" | "incomplete">): () => EngineLike {
  return () => {
    const engine: EngineLike = {
      playerToMove: 0,
      phase: "roundMove",
      round: 1,
      newTurn: false,
      players: [],
      move(line: string) {
        const outcome = behavior[line];
        if (outcome === undefined) {
          throw new Error(`illegal move: ${line}`);
        }
        engine.newTurn = outcome === "ok";
      },
      generateAvailableCommandsIfNeeded() {
        return undefined;
      },
    };
    return engine;
  };
}

describe("resolvePremoveQueue", () => {
  it("returns 'none' for an empty queue", () => {
    const result = resolvePremoveQueue(fakeCloneFactory({}), 0, [], "sequential");
    expect(result).to.deep.equal({ outcome: "none" });
  });

  describe("sequential mode", () => {
    it("fires the lowest-seq entry when it's legal, leaving the rest untouched", () => {
      const clone = fakeCloneFactory({ A: "ok" });
      const result = resolvePremoveQueue(
        clone,
        0,
        [
          { seq: 2, move: "B" },
          { seq: 1, move: "A" },
        ],
        "sequential"
      );
      expect(result.outcome).to.equal("success");
      if (result.outcome === "success") {
        expect(result.move).to.equal("A");
        expect(result.consumedSeqs).to.deep.equal([1]);
        expect(result.rank).to.equal(undefined);
      }
    });

    it("cascades away every later entry when the head throws", () => {
      const clone = fakeCloneFactory({ B: "ok", C: "ok" });
      const result = resolvePremoveQueue(
        clone,
        0,
        [
          { seq: 1, move: "A" },
          { seq: 2, move: "B" },
          { seq: 3, move: "C" },
        ],
        "sequential"
      );
      expect(result.outcome).to.equal("failed");
      if (result.outcome === "failed") {
        expect(result.failedMove).to.equal("A");
        expect(result.consumedSeqs).to.deep.equal([1, 2, 3]);
        expect(result.reason).to.contain("illegal move: A");
        expect(result.reason).to.contain("2 more queued premoves discarded");
      }
    });

    it("does not cascade when the throwing entry has nothing queued behind it", () => {
      const result = resolvePremoveQueue(fakeCloneFactory({}), 0, [{ seq: 1, move: "A" }], "sequential");
      expect(result.outcome).to.equal("failed");
      if (result.outcome === "failed") {
        expect(result.consumedSeqs).to.deep.equal([1]);
        expect(result.reason).to.not.contain("discarded");
      }
    });

    it("does not cascade the defensive incomplete-turn case (only a throw cascades)", () => {
      const clone = fakeCloneFactory({ A: "incomplete" });
      const result = resolvePremoveQueue(
        clone,
        0,
        [
          { seq: 1, move: "A" },
          { seq: 2, move: "B" },
        ],
        "sequential"
      );
      expect(result.outcome).to.equal("failed");
      if (result.outcome === "failed") {
        expect(result.reason).to.equal("premove did not complete a turn");
        expect(result.consumedSeqs).to.deep.equal([1]);
      }
    });
  });

  describe("priority mode", () => {
    it("fires rank 1 when it's legal and clears the whole queue", () => {
      const clone = fakeCloneFactory({ A: "ok", B: "ok" });
      const result = resolvePremoveQueue(
        clone,
        0,
        [
          { seq: 1, move: "A" },
          { seq: 2, move: "B" },
        ],
        "priority"
      );
      expect(result.outcome).to.equal("success");
      if (result.outcome === "success") {
        expect(result.move).to.equal("A");
        expect(result.rank).to.equal(1);
        expect(result.totalRanks).to.equal(2);
        expect(result.consumedSeqs).to.deep.equal([1, 2]);
      }
    });

    it("silently skips an illegal rank 1 and fires rank 2", () => {
      const clone = fakeCloneFactory({ B: "ok" });
      const result = resolvePremoveQueue(
        clone,
        0,
        [
          { seq: 1, move: "A" },
          { seq: 2, move: "B" },
          { seq: 3, move: "C" },
        ],
        "priority"
      );
      expect(result.outcome).to.equal("success");
      if (result.outcome === "success") {
        expect(result.move).to.equal("B");
        expect(result.rank).to.equal(2);
        expect(result.totalRanks).to.equal(3);
        // Every rank clears together, including the never-tried rank 3.
        expect(result.consumedSeqs).to.deep.equal([1, 2, 3]);
      }
    });

    it("records one failure and clears everything when every rank is illegal", () => {
      const result = resolvePremoveQueue(
        fakeCloneFactory({}),
        0,
        [
          { seq: 1, move: "A" },
          { seq: 2, move: "B" },
        ],
        "priority"
      );
      expect(result.outcome).to.equal("failed");
      if (result.outcome === "failed") {
        expect(result.reason).to.equal("none of your 2 ranked premoves were legal");
        expect(result.failedMove).to.equal("A / B");
        expect(result.consumedSeqs).to.deep.equal([1, 2]);
      }
    });

    it("tries each rank against the SAME original state, not a mutated previous attempt", () => {
      let cloneCalls = 0;
      const factory = () => {
        cloneCalls++;
        return fakeCloneFactory({ B: "ok" })();
      };
      const result = resolvePremoveQueue(
        factory,
        0,
        [
          { seq: 1, move: "A" },
          { seq: 2, move: "B" },
        ],
        "priority"
      );
      expect(cloneCalls).to.equal(2); // one fresh clone per rank tried
      expect(result.outcome).to.equal("success");
    });
  });
});
