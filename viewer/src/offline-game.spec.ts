import Engine from "@gaia-project/engine";
import { expect } from "chai";
import fs from "fs";
import {
  isNewOfflineGame,
  isOfflineGameMode,
  OFFLINE_GAME_STORAGE_KEY,
  readOfflineGame,
  restoreOfflineGame,
  writeOfflineGame,
} from "./offline-game";

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

function requireSave(storage: Storage) {
  const result = readOfflineGame(storage);
  if (!result.save) {
    throw new Error(result.error ?? "Expected an offline save");
  }
  return result.save;
}

describe("offline hot-seat games", () => {
  it("recognizes only the explicit offline/new-game URL markers", () => {
    expect(isOfflineGameMode("?offline=1&players=3")).to.equal(true);
    expect(isOfflineGameMode("?players=3")).to.equal(false);
    expect(isNewOfflineGame("?offline=1&new=1")).to.equal(true);
    expect(isNewOfflineGame("?offline=1&new=0")).to.equal(false);
  });

  it("round-trips a complete engine through one versioned local record", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 offline-round-trip"], { lostFleet: true });
    engine.generateAvailableCommandsIfNeeded();

    const written = writeOfflineGame(engine, "", storage, Date.UTC(2026, 6, 17, 10, 30));
    const read = readOfflineGame(storage);

    expect(written.error).to.equal(null);
    expect(read.error).to.equal(null);
    expect(read.save?.savedAt).to.equal("2026-07-17T10:30:00.000Z");
    const restored = restoreOfflineGame(requireSave(storage));
    expect(JSON.parse(JSON.stringify(restored.engine))).to.deep.equal(JSON.parse(JSON.stringify(engine)));
  });

  it("restores an unfinished turn for display while retaining the committed baseline", () => {
    const data = JSON.parse(fs.readFileSync("../engine/fixtures/Beta-2.json", "utf8"));
    const baseline = Engine.fromData(data).replayedTo(17, true);
    const pendingMove = data.moveHistory[17].replace(/\.$/, "");
    const storage = new MemoryStorage();

    writeOfflineGame(baseline, pendingMove, storage);
    const restored = restoreOfflineGame(requireSave(storage));

    expect(restored.pendingMove).to.equal(pendingMove);
    expect(restored.engine.moveHistory).to.deep.equal(baseline.moveHistory);
    expect(restored.displayEngine.newTurn).to.equal(false);
    expect(restored.displayEngine.moveHistory[restored.displayEngine.moveHistory.length - 1]).to.equal(pendingMove);

    const continued = Engine.fromData(JSON.parse(JSON.stringify(restored.engine)));
    continued.move(`${pendingMove}.`);
    expect(continued.newTurn).to.equal(true);
    expect(continued.moveHistory[continued.moveHistory.length - 1]).to.equal(`${pendingMove}.`);
  });

  it("fails safely when storage is corrupt or rejects a write", () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(OFFLINE_GAME_STORAGE_KEY, "{not-json");
    expect(readOfflineGame(corrupt).save).to.equal(null);
    expect(readOfflineGame(corrupt).error).to.contain("could not be read");

    const rejecting = new MemoryStorage();
    rejecting.setItem = () => {
      throw new Error("quota exceeded");
    };
    const engine = new Engine(["init 2 offline-write-error"]);
    const result = writeOfflineGame(engine, "", rejecting);
    expect(result.save).to.equal(null);
    expect(result.error).to.contain("quota exceeded");
  });
});
