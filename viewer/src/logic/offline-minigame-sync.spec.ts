import { expect } from "chai";
import {
  clearOfflineMinigameOps,
  hasPendingOfflineMinigameOps,
  MinigameOp,
  offlineMinigameGameId,
  OFFLINE_MINIGAME_OPS_PREFIX,
  queueOfflineMinigameOp,
  readOfflineMinigameMirror,
  readOfflineMinigameOps,
  uploadOfflineMinigameOps,
  writeOfflineMinigameMirror,
} from "./offline-minigame-sync";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const GAME = "online-3f0e6b1a";

/** Stands in for a hosted board: applies a move only when the board still matches `previous`. */
function fakeBackend(initial: string, opts: { rejectFrom?: number; movedBy?: string } = {}) {
  const calls: string[] = [];
  let board = initial;
  let attempt = 0;
  return {
    calls,
    get board() {
      return board;
    },
    async move(previous: string, next: string) {
      attempt++;
      calls.push(`move:${previous}->${next}`);
      if (opts.rejectFrom && attempt >= opts.rejectFrom) {
        throw new Error("not your move");
      }
      if (board !== previous) {
        // Exactly what the real RPCs do: ignore the write and hand back what is actually stored.
        return board;
      }
      board = next;
      return next;
    },
    async reset() {
      calls.push("reset");
      board = initial;
    },
  };
}

describe("offline minigame sync", () => {
  it("derives the op log's game id from the offline URL, sandboxing a game-less viewer", () => {
    expect(offlineMinigameGameId("?offline=1&game=online-abc")).to.equal("online-abc");
    expect(offlineMinigameGameId("?players=2")).to.equal("sandbox");
  });

  it("queues ops per game and keeps them until they are explicitly cleared", () => {
    const storage = new MemoryStorage();
    expect(hasPendingOfflineMinigameOps(GAME, storage)).to.equal(false);

    queueOfflineMinigameOp(GAME, "chess", { kind: "move", previous: "a", next: "b", from: "e2", to: "e4" }, storage);
    queueOfflineMinigameOp(GAME, "chess", { kind: "reset" }, storage);
    queueOfflineMinigameOp(GAME, "renju", { kind: "move", previous: "x", next: "y", index: 7 }, storage);

    expect(readOfflineMinigameOps(GAME, "chess", storage)).to.have.length(2);
    expect(readOfflineMinigameOps(GAME, "renju", storage)).to.deep.equal([
      { kind: "move", previous: "x", next: "y", index: 7 },
    ]);
    expect(readOfflineMinigameOps(GAME, "ultimate", storage)).to.deep.equal([]);
    expect(hasPendingOfflineMinigameOps(GAME, storage)).to.equal(true);

    // Clearing one game leaves the others alone.
    clearOfflineMinigameOps(GAME, "chess", storage);
    expect(readOfflineMinigameOps(GAME, "chess", storage)).to.deep.equal([]);
    expect(readOfflineMinigameOps(GAME, "renju", storage)).to.have.length(1);
  });

  it("carries the hosted assignments and this account's id, so offline play knows whose move it is", () => {
    const storage = new MemoryStorage();
    const row = { fen: "somefen", white_user: "me", black_user: "them" };
    expect(writeOfflineMinigameMirror(GAME, "me", { chess: row }, storage)).to.equal(true);

    const mirror = readOfflineMinigameMirror(GAME, storage);
    expect(mirror?.userId).to.equal("me");
    expect(mirror?.rows.chess).to.deep.equal(row);
    expect(readOfflineMinigameMirror("some-other-game", storage)).to.equal(null);
  });

  it("replays a whole offline session in order, moves and resets alike", async () => {
    const backend = fakeBackend("start");
    const ops: MinigameOp[] = [
      { kind: "move", previous: "start", next: "p1", index: 1 },
      { kind: "move", previous: "p1", next: "p2", index: 2 },
      { kind: "reset" },
      { kind: "move", previous: "start", next: "p3", index: 3 },
    ];

    const result = await uploadOfflineMinigameOps(backend, "renju", ops);

    expect(result).to.deep.equal({ uploaded: 4, remaining: [], conflict: false });
    expect(backend.calls).to.deep.equal(["move:start->p1", "move:p1->p2", "reset", "move:start->p3"]);
    expect(backend.board).to.equal("p3");
  });

  it("stops at a move the online board has moved past, and hands back everything unsent", async () => {
    // The opponent played while this device was offline, so the board is no longer `start`.
    const backend = fakeBackend("opponent-moved");
    const ops: MinigameOp[] = [
      { kind: "move", previous: "start", next: "p1", index: 1 },
      { kind: "move", previous: "p1", next: "p2", index: 2 },
    ];

    const result = await uploadOfflineMinigameOps(backend, "renju", ops);

    expect(result.uploaded).to.equal(0);
    expect(result.conflict).to.equal(true);
    // Nothing is dropped: both ops come back for the caller to keep queued.
    expect(result.remaining).to.deep.equal(ops);
    expect(backend.board, "the online board is left exactly as the opponent left it").to.equal("opponent-moved");
  });

  it("stops at a move the server refuses (not your colour), keeping the rest", async () => {
    const backend = fakeBackend("start", { rejectFrom: 2 });
    const ops: MinigameOp[] = [
      { kind: "move", previous: "start", next: "p1", index: 1 },
      { kind: "move", previous: "p1", next: "p2", index: 2 },
      { kind: "move", previous: "p2", next: "p3", index: 3 },
    ];

    const result = await uploadOfflineMinigameOps(backend, "renju", ops);

    expect(result.uploaded).to.equal(1);
    expect(result.conflict).to.equal(true);
    expect(result.remaining).to.deep.equal(ops.slice(1));
  });

  it("passes chess moves with their squares and the other games with their cell index", async () => {
    const seen: any[] = [];
    const backend = {
      async move(previous: string, next: string, a: any, b?: any) {
        seen.push({ previous, next, a, b });
        return next;
      },
      async reset() {
        // not used here
      },
    };

    await uploadOfflineMinigameOps(backend, "chess", [
      { kind: "move", previous: "f1", next: "f2", from: "e2", to: "e4" },
    ]);
    await uploadOfflineMinigameOps(backend, "ultimate", [{ kind: "move", previous: "b1", next: "b2", index: 40 }]);

    expect(seen[0]).to.deep.equal({ previous: "f1", next: "f2", a: "e2", b: "e4" });
    expect(seen[1]).to.deep.equal({ previous: "b1", next: "b2", a: 40, b: undefined });
  });

  it("treats a corrupt op log as empty instead of blocking play", () => {
    const storage = new MemoryStorage();
    storage.setItem(`${OFFLINE_MINIGAME_OPS_PREFIX}${GAME}`, "{not-json");

    expect(readOfflineMinigameOps(GAME, "chess", storage)).to.deep.equal([]);
    expect(hasPendingOfflineMinigameOps(GAME, storage)).to.equal(false);
    // ...and the next op written repairs the record.
    queueOfflineMinigameOp(GAME, "chess", { kind: "reset" }, storage);
    expect(readOfflineMinigameOps(GAME, "chess", storage)).to.deep.equal([{ kind: "reset" }]);
  });

  it("does nothing in a browser without local storage", () => {
    expect(readOfflineMinigameMirror(GAME, null)).to.equal(null);
    expect(writeOfflineMinigameMirror(GAME, "me", {}, null)).to.equal(false);
    expect(queueOfflineMinigameOp(GAME, "chess", { kind: "reset" }, null)).to.equal(false);
    expect(readOfflineMinigameOps(GAME, "chess", null)).to.deep.equal([]);
  });
});
