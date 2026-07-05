import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  Backend,
  CommitAutomatedTurnArgs,
  EngineModule,
  GameRow,
  MoveRow,
  PremoveRow,
  resolveOneAutomatedTurn,
} from "../supabase/functions/resolve-automation/logic";

// Exercises resolve-automation's pure decision logic (PREMOVE_PLAN.md §9) against the real, bundled
// engine (dynamically imported exactly like engine/edge-bundle-parity.spec.ts) with a fake backend -
// no Deno, no network, no Supabase. Skips itself if the bundle hasn't been built yet.
describe("resolve-automation logic", () => {
  const bundlePath = path.join(__dirname, "..", "supabase", "functions", "_shared", "engine.bundle.js");

  before(function () {
    if (!fs.existsSync(bundlePath)) {
      this.skip();
    }
  });

  async function loadEngineModule(): Promise<EngineModule> {
    return import(bundlePath);
  }

  const SETUP_MOVES = [
    "p1 faction terrans",
    "p2 faction nevlas",
    "terrans build m -1x2",
    "nevlas build m -1x0",
    "nevlas build m 0x-4",
    "terrans build m -4x-1",
    "nevlas booster booster7",
    "terrans booster booster3",
  ];

  function fakeBackend(overrides: Partial<Backend> = {}): {
    backend: Backend;
    deleted: { seat: number; seq: number }[];
    failures: { seat: number; move: string; reason: string }[];
    committed: CommitAutomatedTurnArgs[];
  } {
    const deleted: { seat: number; seq: number }[] = [];
    const failures: { seat: number; move: string; reason: string }[] = [];
    const committed: CommitAutomatedTurnArgs[] = [];
    const backend: Backend = {
      fetchGame: async () => ({
        id: "g1",
        seed: "randomSeed",
        player_count: 2,
        options: {},
        move_count: SETUP_MOVES.length,
      }),
      fetchMoves: async () => SETUP_MOVES.map((move, i) => ({ seq: i + 1, move })),
      fetchLowestSeqPremove: async () => null,
      deletePremove: async (_gameId, seat, seq) => {
        deleted.push({ seat, seq });
      },
      insertPremoveFailure: async (_gameId, seat, move, reason) => {
        failures.push({ seat, move, reason });
      },
      commitAutomatedTurn: async (args) => {
        committed.push(args);
      },
      ...overrides,
    };
    return { backend, deleted, failures, committed };
  }

  it("no-ops when the trigger is stale (playerToMove has moved on)", async () => {
    const engineModule = await loadEngineModule();
    const { backend } = fakeBackend();
    // After SETUP_MOVES, playerToMove is 0 (terrans) - ask for seat 1 instead.
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 1);
    expect(result).to.deep.equal({ outcome: "stale-trigger" });
  });

  it("no-ops when there is no premove queued for the seat now on turn", async () => {
    const engineModule = await loadEngineModule();
    const { backend } = fakeBackend({ fetchLowestSeqPremove: async () => null });
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 0);
    expect(result).to.deep.equal({ outcome: "no-premove-queued" });
  });

  it("commits a queued premove that completes a turn, then deletes it", async () => {
    const engineModule = await loadEngineModule();
    const premove: PremoveRow = { seq: 1, move: "terrans build m 3B0." };
    const { backend, deleted, committed } = fakeBackend({ fetchLowestSeqPremove: async () => premove });
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 0);
    expect(result.outcome).to.equal("committed");
    expect(committed).to.have.length(1);
    expect(committed[0].seat).to.equal(0);
    expect(committed[0].move).to.equal(premove.move);
    expect(committed[0].seq).to.equal(SETUP_MOVES.length + 1);
    expect(deleted).to.deep.equal([{ seat: 0, seq: 1 }]);
  });

  it("deletes the premove and records a failure when it throws (illegal move)", async () => {
    const engineModule = await loadEngineModule();
    const premove: PremoveRow = { seq: 1, move: "terrans build m 99x99" };
    const { backend, deleted, failures, committed } = fakeBackend({ fetchLowestSeqPremove: async () => premove });
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 0);
    expect(result.outcome).to.equal("premove-failed");
    expect(committed).to.have.length(0);
    expect(deleted).to.deep.equal([{ seat: 0, seq: 1 }]);
    expect(failures).to.have.length(1);
    expect(failures[0].move).to.equal(premove.move);
  });

  it("deletes the premove and records a failure when it doesn't complete a turn", async () => {
    const engineModule = await loadEngineModule();
    // A bare "up nav" is legal but doesn't end the turn on its own.
    const premove: PremoveRow = { seq: 1, move: "terrans up nav" };
    const { backend, deleted, failures, committed } = fakeBackend({ fetchLowestSeqPremove: async () => premove });
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 0);
    expect(result.outcome).to.equal("premove-incomplete-turn");
    expect(committed).to.have.length(0);
    expect(deleted).to.deep.equal([{ seat: 0, seq: 1 }]);
    expect(failures[0].reason).to.equal("premove did not complete a turn");
  });

  it("is a no-op outside of Phase.RoundMove (e.g. RoundLeech), leaving the premove untouched", async () => {
    const engineModule = await loadEngineModule();
    const movesUpToLeech = [...SETUP_MOVES, "terrans build ts -1x2."]; // triggers nevlas's leech decision
    const premove: PremoveRow = { seq: 1, move: "nevlas build m -3x3" };
    const { backend, deleted, failures, committed } = fakeBackend({
      fetchMoves: async () => movesUpToLeech.map((move, i) => ({ seq: i + 1, move })),
      fetchGame: async () => ({
        id: "g1",
        seed: "randomSeed",
        player_count: 2,
        options: {},
        move_count: movesUpToLeech.length,
      }),
      fetchLowestSeqPremove: async () => premove,
    });
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 1);
    expect(result.outcome).to.equal("wrong-phase");
    expect(deleted).to.have.length(0);
    expect(failures).to.have.length(0);
    expect(committed).to.have.length(0);
  });

  it("silently no-ops on seq_conflict without touching the premove", async () => {
    const engineModule = await loadEngineModule();
    const premove: PremoveRow = { seq: 1, move: "terrans build m 3B0." };
    const { backend, deleted, failures } = fakeBackend({
      fetchLowestSeqPremove: async () => premove,
      commitAutomatedTurn: async () => {
        throw new Error("seq_conflict: expected 9, got 9");
      },
    });
    const result = await resolveOneAutomatedTurn(engineModule, backend, "g1", 0);
    expect(result).to.deep.equal({ outcome: "seq-conflict" });
    expect(deleted).to.have.length(0);
    expect(failures).to.have.length(0);
  });
});
