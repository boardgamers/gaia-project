import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { listOfflineGames, offlineGameListRow, readStoredOfflineGame, restoreOfflineGame } from "../offline-game";
import {
  isOfflineMirrorEnabled,
  listOfflineMirroredGameIds,
  mirrorOfflineGameId,
  OFFLINE_MIRROR_PREFS_KEY,
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

/** Serialized hosted state, exactly as host.ts's `onCommittedState` hands it over. */
function committedState(moves: string[]): any {
  const engine = new Engine(["init 2 mirror-seed", ...moves], { lostFleet: true });
  engine.generateAvailableCommandsIfNeeded();
  return JSON.parse(JSON.stringify(engine));
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

    const before = syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState([]), storage);
    expect(before.skipped).to.equal(true);
    expect(before.save).to.equal(null);
    expect(listOfflineGames(storage).games).to.have.length(0);

    expect(setOfflineMirrorEnabled(HOSTED_ID, true, storage)).to.deep.equal({ enabled: true, error: null });
    expect(isOfflineMirrorEnabled(HOSTED_ID, storage)).to.equal(true);
    expect(isOfflineMirrorEnabled("some-other-game", storage)).to.equal(false);

    const after = syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState([]), storage, Date.UTC(2026, 6, 29, 10));
    expect(after.error).to.equal(null);
    expect(after.skipped).to.equal(false);
    expect(after.save?.id).to.equal(`online-${HOSTED_ID}`);
    expect(after.save?.mirrorOf).to.equal(HOSTED_ID);
    expect(listOfflineGames(storage).games.map((game) => game.name)).to.deep.equal(["Copper Nova"]);
  });

  it("keeps overwriting the same record as online moves arrive, and opens as a playable offline game", () => {
    const storage = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, storage);

    syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState([]), storage, Date.UTC(2026, 6, 29, 10));
    // The engine annotates a committed line with its resource deltas, so the expected history comes
    // from the engine itself rather than from the move text handed in.
    const online = committedState(["p1 faction terrans", "p2 faction nevlas"]);
    const second = syncOfflineMirror(HOSTED_ID, "Copper Nova", online, storage, Date.UTC(2026, 6, 29, 11));

    expect(second.error).to.equal(null);
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
    const storage = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, storage);
    const state = committedState(["p1 faction terrans"]);

    syncOfflineMirror(HOSTED_ID, "Copper Nova", state, storage, Date.UTC(2026, 6, 29, 10));
    const again = syncOfflineMirror(HOSTED_ID, "Copper Nova", state, storage, Date.UTC(2026, 6, 29, 12));

    expect(again.skipped).to.equal(true);
    // Untouched, not rewritten with a fresh timestamp.
    expect(readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save?.savedAt).to.equal(
      "2026-07-29T10:00:00.000Z"
    );

    // A rename online is a real change, even with the same move history.
    const renamed = syncOfflineMirror(HOSTED_ID, "Copper Nova II", state, storage, Date.UTC(2026, 6, 29, 13));
    expect(renamed.skipped).to.equal(false);
    expect(renamed.save?.name).to.equal("Copper Nova II");
  });

  it("replaces moves played locally in the copy - the online game is authoritative", () => {
    const storage = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, storage);
    syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState(["p1 faction terrans"]), storage);

    // Someone played on in the offline copy (Game.vue's offline save path), forking it.
    const local = readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save;
    if (!local) {
      throw new Error("expected the mirrored record");
    }
    local.engineData.moveHistory.push("p2 faction ambas");
    storage.setItem(`gaia-offline-game-v2:${local.id}`, JSON.stringify(local));

    const online = committedState(["p1 faction terrans", "p2 faction nevlas"]);
    syncOfflineMirror(HOSTED_ID, "Copper Nova", online, storage);

    expect(readStoredOfflineGame(local.id, storage).save?.engineData.moveHistory).to.deep.equal(online.moveHistory);
  });

  it("stops syncing when switched off, and leaves the copy already on the device alone", () => {
    const storage = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, storage);
    syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState([]), storage, Date.UTC(2026, 6, 29, 10));

    expect(setOfflineMirrorEnabled(HOSTED_ID, false, storage)).to.deep.equal({ enabled: false, error: null });
    expect(listOfflineMirroredGameIds(storage)).to.deep.equal([]);

    const later = syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState(["p1 faction terrans"]), storage);
    expect(later.skipped).to.equal(true);
    const stored = readStoredOfflineGame(mirrorOfflineGameId(HOSTED_ID), storage).save;
    expect(stored?.savedAt).to.equal("2026-07-29T10:00:00.000Z");
    expect(stored?.engineData.moveHistory).to.deep.equal(["init 2 mirror-seed"]);
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
    const result = syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState([]), rejecting);
    expect(result.save).to.equal(null);
    expect(result.error).to.contain("quota exceeded");

    const enabled = new MemoryStorage();
    setOfflineMirrorEnabled(HOSTED_ID, true, enabled);
    expect(syncOfflineMirror(HOSTED_ID, "Copper Nova", { notAnEngine: true }, enabled)).to.deep.equal({
      save: null,
      error: "That game state cannot be stored offline.",
      skipped: false,
    });
  });

  it("does nothing at all in a browser without local storage", () => {
    expect(isOfflineMirrorEnabled(HOSTED_ID, null)).to.equal(false);
    expect(setOfflineMirrorEnabled(HOSTED_ID, true, null).error).to.contain("Local storage is unavailable");
    expect(syncOfflineMirror(HOSTED_ID, "Copper Nova", committedState([]), null).skipped).to.equal(true);
  });
});
