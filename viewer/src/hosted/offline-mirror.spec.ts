import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { listOfflineGames, offlineGameListRow, readStoredOfflineGame, restoreOfflineGame } from "../offline-game";
import {
  compareMoveHistories,
  isOfflineMirrorEnabled,
  listOfflineMirroredGameIds,
  mirrorOfflineGameId,
  offlineMirrorSeatLock,
  OFFLINE_MIRROR_PREFS_KEY,
  planOfflineUpload,
  readOfflineMirrorState,
  setOfflineMirrorEnabled,
  syncOfflineMirror,
} from "./offline-mirror";

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

const HOSTED_ID = "3f0e6b1a-1111-4222-8333-444455556666";

// The same 2-player fixture host.spec.ts uses, so the moves below are known-legal in this order.
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

/** Serialized hosted state, exactly as host.ts's `onCommittedState` hands it over. */
function committedState(moves: string[] = [], seed = "randomSeed"): any {
  const engine = new Engine([`init 2 ${seed}`, ...moves]);
  engine.generateAvailableCommandsIfNeeded();
  return JSON.parse(JSON.stringify(engine));
}

/** Writes `moves` straight into the stored copy, standing in for play in the offline viewer. */
function playOffline(storage: Storage, moves: string[]): string[] {
  const id = mirrorOfflineGameId(HOSTED_ID);
  const save = readStoredOfflineGame(id, storage).save;
  if (!save) {
    throw new Error("expected a mirrored record");
  }
  const engine = Engine.fromData(JSON.parse(JSON.stringify(save.engineData)));
  engine.generateAvailableCommandsIfNeeded();
  for (const move of moves) {
    engine.move(move);
    engine.generateAvailableCommandsIfNeeded();
  }
  save.engineData = JSON.parse(JSON.stringify(engine));
  save.savedAt = new Date(Date.UTC(2026, 6, 30, 9)).toISOString();
  storage.setItem(`gaia-offline-game-v2:${id}`, JSON.stringify(save));
  return engine.moveHistory;
}

function enabled(seats: number[] = [0]): MemoryStorage {
  const storage = new MemoryStorage();
  setOfflineMirrorEnabled(HOSTED_ID, true, storage);
  syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState(SETUP_MOVES), seats, storage, Date.UTC(2026, 6, 29, 10));
  return storage;
}

describe("hosted -> offline copy", () => {
  it("derives one stable offline id per hosted game", () => {
    expect(mirrorOfflineGameId(HOSTED_ID)).to.equal(`online-${HOSTED_ID}`);
    expect(mirrorOfflineGameId(HOSTED_ID)).to.equal(mirrorOfflineGameId(HOSTED_ID));
    // The offline library only accepts [a-z0-9-] ids, so anything else has to be folded away.
    expect(mirrorOfflineGameId("game 1_x")).to.equal("online-game-1-x");
  });

  it("stores nothing until the setting is turned on for that game", () => {
    const storage = new MemoryStorage();

    const before = syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState(), [0], storage);
    expect(before.skipped).to.equal(true);
    expect(before.save).to.equal(null);
    expect(listOfflineGames(storage).games).to.have.length(0);

    expect(setOfflineMirrorEnabled(HOSTED_ID, true, storage)).to.deep.equal({ enabled: true, error: null });
    expect(isOfflineMirrorEnabled(HOSTED_ID, storage)).to.equal(true);
    expect(isOfflineMirrorEnabled("some-other-game", storage)).to.equal(false);

    const after = syncOfflineMirror(
      HOSTED_ID,
      "Copper Nova",
      committedState(),
      [1],
      storage,
      Date.UTC(2026, 6, 29, 10)
    );
    expect(after.error).to.equal(null);
    expect(after.skipped).to.equal(false);
    expect(after.save?.id).to.equal(`online-${HOSTED_ID}`);
    expect(after.save?.mirrorOf).to.equal(HOSTED_ID);
    // Which seats may be played offline: only those can ever be committed for online.
    expect(after.save?.mirrorSeats).to.deep.equal([1]);
    expect(listOfflineGames(storage).games.map((game) => game.name)).to.deep.equal(["Copper Nova"]);
  });

  it("refreshes the same record as online moves arrive, and opens as a playable offline game", () => {
    const storage = enabled();

    const online = committedState([...SETUP_MOVES, "terrans build ts -1x2."]);
    const second = syncOfflineMirror(HOSTED_ID, "Copper Nova", online, [0], storage, Date.UTC(2026, 6, 29, 11));

    expect(second.error).to.equal(null);
    expect(second.relation).to.equal("behind");
    // One record, not one per sync - and its original creation date survives the overwrite.
    expect(listOfflineGames(storage).games).to.have.length(1);
    expect(second.save?.createdAt).to.equal("2026-07-29T10:00:00.000Z");
    expect(second.save?.savedAt).to.equal("2026-07-29T11:00:00.000Z");

    const stored = readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save;
    if (!stored) {
      throw new Error("expected the mirrored record");
    }
    expect(stored.engineData.moveHistory).to.deep.equal(online.moveHistory);
    // The whole point: it restores and continues like any other offline game.
    const restored = restoreOfflineGame(stored);
    expect(restored.warning).to.equal(null);
    expect(restored.engine.moveHistory).to.deep.equal(stored.engineData.moveHistory);
    expect(offlineGameListRow(stored).mirror_of).to.equal(HOSTED_ID);
  });

  it("skips the write when the same committed state is emitted again", () => {
    const storage = enabled();
    const state = committedState(SETUP_MOVES);

    const again = syncOfflineMirror(HOSTED_ID, "Copper Nova", state, [0], storage, Date.UTC(2026, 6, 29, 12));

    expect(again.relation).to.equal("same");
    expect(again.skipped).to.equal(true);
    // Untouched, not rewritten with a fresh timestamp.
    expect(readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save?.savedAt).to.equal(
      "2026-07-29T10:00:00.000Z"
    );

    // A rename online is a real change, even with the same move history.
    const renamed = syncOfflineMirror(HOSTED_ID, "Copper Nova II", state, [0], storage, Date.UTC(2026, 6, 29, 13));
    expect(renamed.skipped).to.equal(false);
    expect(renamed.save?.name).to.equal("Copper Nova II");
  });

  describe("moves played offline", () => {
    it("classifies the copy against the online history without needing the engine", () => {
      expect(compareMoveHistories([], ["init"])).to.equal("none");
      expect(compareMoveHistories(["init", "a"], ["init", "a"])).to.equal("same");
      expect(compareMoveHistories(["init", "a"], ["init", "a", "b"])).to.equal("behind");
      expect(compareMoveHistories(["init", "a", "b"], ["init", "a"])).to.equal("ahead");
      expect(compareMoveHistories(["init", "a", "b"], ["init", "a", "c"])).to.equal("diverged");
      expect(compareMoveHistories(["init", "a", "b"], ["init", "c"])).to.equal("diverged");
    });

    it("NEVER overwrites a copy holding offline moves with an online state that is behind it", () => {
      const storage = enabled();
      const offlineHistory = playOffline(storage, ["terrans build ts -1x2."]);

      // The online game is exactly where it was when the plane took off.
      const result = syncOfflineMirror(
        HOSTED_ID,
        "Copper Nova",
        committedState(SETUP_MOVES),
        [0],
        storage,
        Date.UTC(2026, 6, 30, 10)
      );

      expect(result.relation).to.equal("ahead");
      expect(result.skipped, "an ahead copy must not be written over").to.equal(true);
      expect(result.offlineMoves).to.deep.equal(offlineHistory.slice(SETUP_MOVES.length + 1));
      const stored = readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save;
      expect(stored?.engineData.moveHistory).to.deep.equal(offlineHistory);
      expect(stored?.savedAt, "not even re-stamped").to.equal("2026-07-30T09:00:00.000Z");
    });

    it("plans those moves for upload, in order, replaying them against the online state", () => {
      const storage = enabled();
      playOffline(storage, ["terrans build ts -1x2."]);
      const online = committedState(SETUP_MOVES);
      const state = readOfflineMirrorState(HOSTED_ID, online.moveHistory, storage);

      const plan = planOfflineUpload(online, state.offlineMoves, (seat) => seat === 0);

      expect(plan.blocked).to.equal(null);
      expect(plan.moves).to.deep.equal(state.offlineMoves);
      // Each planned move is a complete turn the online engine accepts from its current state.
      const check = Engine.fromData(JSON.parse(JSON.stringify(online)));
      check.generateAvailableCommandsIfNeeded();
      for (const move of plan.moves) {
        check.move(move);
        check.generateAvailableCommandsIfNeeded();
        expect(check.newTurn).to.equal(true);
      }
    });

    it("records which seats may be played offline, and locks a spectator's copy out of play", () => {
      const storage = enabled([1]);
      const save = readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save;
      expect(offlineMirrorSeatLock(save)).to.deep.equal([1]);

      // A spectator holds no seat: an empty list is a real lock (seatToLock's unplayable
      // placeholder), not the absence of one.
      const spectatorStorage = enabled([]);
      expect(offlineMirrorSeatLock(readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), spectatorStorage).save)) //
        .to.deep.equal([]);

      // An ordinary pass-and-play game, and a mirrored record written before seats were recorded,
      // both keep the unlocked hot seat.
      expect(offlineMirrorSeatLock(null)).to.equal(null);
      expect(offlineMirrorSeatLock({ ...save!, mirrorOf: undefined })).to.equal(null);
      expect(offlineMirrorSeatLock({ ...save!, mirrorSeats: undefined })).to.equal(null);
    });

    it("stops at the first move for a seat this account does not hold, keeping the rest offline", () => {
      const storage = enabled([0]);
      // Terrans (seat 0) upgrades, which hands nevlas (seat 1) a leech decision - a move this
      // account can never commit online, so the run has to stop there.
      playOffline(storage, ["terrans build ts -1x2.", "nevlas charge 1pw"]);
      const online = committedState(SETUP_MOVES);
      const state = readOfflineMirrorState(HOSTED_ID, online.moveHistory, storage);
      expect(state.offlineMoves).to.have.length(2);

      const plan = planOfflineUpload(online, state.offlineMoves, (seat) => seat === 0);

      expect(plan.moves).to.deep.equal([state.offlineMoves[0]]);
      expect(plan.blocked?.reason).to.equal("other-seat");
      expect(plan.blocked?.seat).to.equal(1);
    });

    it("refuses to force a move the online game has moved past, and keeps the copy intact", () => {
      const storage = enabled();
      playOffline(storage, ["terrans build ts -1x2."]);
      // The seat played something else online (another device, a queued premove) before this
      // browser could upload: same index, different move, so the histories genuinely disagree
      // rather than one being a prefix of the other.
      const online = committedState([...SETUP_MOVES, "terrans up terra."]);
      const state = readOfflineMirrorState(HOSTED_ID, online.moveHistory, storage);
      expect(state.relation).to.equal("diverged");
      expect(state.offlineMoves, "a diverged copy offers nothing for upload").to.deep.equal([]);

      const result = syncOfflineMirror(HOSTED_ID, "Copper Nova", online, [0], storage, Date.UTC(2026, 6, 30, 11));
      expect(result.relation).to.equal("diverged");
      expect(result.skipped).to.equal(true);
      expect(readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save?.savedAt).to.equal(
        "2026-07-30T09:00:00.000Z"
      );

      // And an offline move that is simply illegal from the online state is reported, not sent.
      const plan = planOfflineUpload(online, ["terrans build ts -1x2."], () => true);
      expect(plan.moves).to.deep.equal([]);
      expect(plan.blocked?.reason).to.equal("rejected");
    });

    it("resumes ordinary mirroring once the offline moves have landed online", () => {
      const storage = enabled();
      const offlineHistory = playOffline(storage, ["terrans build ts -1x2."]);

      // What the online game looks like after hosted.ts has uploaded that move.
      const online = committedState([...SETUP_MOVES, "terrans build ts -1x2."]);
      expect(online.moveHistory).to.deep.equal(offlineHistory);
      const result = syncOfflineMirror(HOSTED_ID, "Copper Nova", online, [0], storage, Date.UTC(2026, 6, 30, 12));

      expect(result.relation).to.equal("same");
      const next = syncOfflineMirror(
        HOSTED_ID,
        "Copper Nova",
        committedState([...SETUP_MOVES, "terrans build ts -1x2.", "nevlas charge 1pw"]),
        [0],
        storage,
        Date.UTC(2026, 6, 30, 13)
      );
      expect(next.relation).to.equal("behind");
      expect(next.skipped).to.equal(false);
      expect(next.save?.savedAt).to.equal("2026-07-30T13:00:00.000Z");
    });
  });

  it("stops syncing when switched off, and leaves the copy already on the device alone", () => {
    const storage = enabled();

    expect(setOfflineMirrorEnabled(HOSTED_ID, false, storage)).to.deep.equal({ enabled: false, error: null });
    expect(listOfflineMirroredGameIds(storage)).to.deep.equal([]);

    const later = syncOfflineMirror(
      HOSTED_ID,
      "Copper Nova",
      committedState([...SETUP_MOVES, "terrans build ts -1x2."]),
      [0],
      storage
    );
    expect(later.skipped).to.equal(true);
    const stored = readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save;
    expect(stored?.savedAt).to.equal("2026-07-29T10:00:00.000Z");
    expect(stored?.engineData.moveHistory).to.have.length(SETUP_MOVES.length + 1);
  });

  it("fails safely on corrupt settings and on a storage write that is rejected", () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(OFFLINE_MIRROR_PREFS_KEY, "{not-json");
    // Unreadable settings must read as "nothing is mirrored" rather than throwing mid-move.
    expect(isOfflineMirrorEnabled(HOSTED_ID, corrupt)).to.equal(false);
    expect(setOfflineMirrorEnabled(HOSTED_ID, true, corrupt).error).to.equal(null);
    expect(isOfflineMirrorEnabled(HOSTED_ID, corrupt)).to.equal(true);

    const rejecting = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, rejecting);
    rejecting.setItem = () => {
      throw new Error("quota exceeded");
    };
    const result = syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState(), [0], rejecting);
    expect(result.save).to.equal(null);
    expect(result.error).to.contain("quota exceeded");

    const enabledStorage = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, enabledStorage);
    expect(syncOfflineMirror(HOSTED_ID, "Copper Nova", { notAnEngine: true }, [0], enabledStorage)).to.deep.equal({
      save: null,
      error: "That game state cannot be stored offline.",
      skipped: false,
      relation: "none",
      offlineMoves: [],
    });
    // A planner handed something that isn't an engine reports a blockage instead of throwing.
    expect(planOfflineUpload({ notAnEngine: true }, ["terrans build ts -1x2."], () => true).blocked?.reason).to.equal(
      "rejected"
    );
  });

  it("does nothing at all in a browser without local storage", () => {
    expect(isOfflineMirrorEnabled(HOSTED_ID, null)).to.equal(false);
    expect(setOfflineMirrorEnabled(HOSTED_ID, true, null).error).to.contain("Local storage is unavailable");
    expect(syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState(), [0], null).skipped).to.equal(true);
  });
});
