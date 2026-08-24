import Engine, { AuctionVariant } from "@gaia-project/engine";
import { expect } from "chai";
import fs from "fs";
import {
  createStoredOfflineGame,
  deleteStoredOfflineGame,
  importOfflineGameBackup,
  isOfflineGameMode,
  listOfflineGames,
  OFFLINE_GAME_LIBRARY_KEY,
  OFFLINE_GAME_STORAGE_KEY,
  offlineGameListRow,
  readOfflineGame,
  readStoredOfflineGame,
  restoreOfflineGame,
  serializeOfflineGameBackup,
  upsertStoredOfflineGame,
  writeOfflineGame,
  writeStoredOfflineGame,
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
  it("recognizes only the explicit offline URL marker", () => {
    expect(isOfflineGameMode("?offline=1&players=3")).to.equal(true);
    expect(isOfflineGameMode("?players=3")).to.equal(false);
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

  it("migrates the original single save into the multi-game offline library", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 offline-legacy"], { lostFleet: true });
    writeOfflineGame(engine, "", storage, Date.UTC(2026, 6, 17, 10, 30));

    const library = listOfflineGames(storage);

    expect(library.error).to.equal(null);
    expect(library.games).to.have.length(1);
    expect(library.games[0].name).to.equal("Imported offline game");
    expect(library.games[0].engineData.moveHistory).to.deep.equal(engine.moveHistory);
    expect(storage.getItem(OFFLINE_GAME_LIBRARY_KEY)).to.not.equal(null);
    expect(readOfflineGame(storage).save?.engineData.moveHistory).to.deep.equal(engine.moveHistory);
  });

  it("creates, independently updates, lists, and deletes multiple offline games", () => {
    const storage = new MemoryStorage();
    const alpha = new Engine(["init 2 offline-alpha"], { lostFleet: true });
    const beta = new Engine(["init 3 offline-beta"], { auction: AuctionVariant.Silent, banPhase: true });

    expect(createStoredOfflineGame(alpha, "Alpha", storage, Date.UTC(2026, 6, 17, 10), "alpha").error).to.equal(null);
    expect(createStoredOfflineGame(beta, "Beta", storage, Date.UTC(2026, 6, 17, 11), "beta").error).to.equal(null);
    expect(listOfflineGames(storage).games.map((game) => game.name)).to.deep.equal(["Beta", "Alpha"]);

    const updated = writeStoredOfflineGame("alpha", alpha, "p1 faction terrans", storage, Date.UTC(2026, 6, 17, 12));
    expect(updated.error).to.equal(null);
    expect(readStoredOfflineGame("alpha", storage).save?.pendingMove).to.equal("p1 faction terrans");
    expect(readStoredOfflineGame("beta", storage).save?.pendingMove).to.equal(undefined);
    expect(listOfflineGames(storage).games.map((game) => game.name)).to.deep.equal(["Alpha", "Beta"]);

    expect(deleteStoredOfflineGame("beta", storage)).to.deep.equal({ deleted: true, error: null });
    expect(listOfflineGames(storage).games.map((game) => game.name)).to.deep.equal(["Alpha"]);
    expect(readStoredOfflineGame("beta", storage).save).to.equal(null);
  });

  it("creates a record under a caller-chosen id and overwrites it in place on every later save", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 offline-upsert"], { lostFleet: true });

    const created = upsertStoredOfflineGame(
      "online-abc",
      JSON.parse(JSON.stringify(engine)),
      "Copper Nova",
      { of: "abc", seats: [1] },
      storage,
      Date.UTC(2026, 6, 29, 10)
    );
    expect(created.error).to.equal(null);
    expect(created.save?.mirrorOf).to.equal("abc");
    expect(created.save?.mirrorSeats).to.deep.equal([1]);

    // A half-composed turn on the existing record is dropped with the state it belonged to.
    writeStoredOfflineGame("online-abc", engine, "p1 faction terrans", storage, Date.UTC(2026, 6, 29, 11));
    engine.move("p1 faction terrans");
    const updated = upsertStoredOfflineGame(
      "online-abc",
      JSON.parse(JSON.stringify(engine)),
      "Copper Nova",
      { of: "abc", seats: [1] },
      storage,
      Date.UTC(2026, 6, 29, 12)
    );

    expect(updated.error).to.equal(null);
    expect(updated.save?.createdAt, "the original creation date survives an overwrite").to.equal(
      "2026-07-29T10:00:00.000Z"
    );
    expect(updated.save?.savedAt).to.equal("2026-07-29T12:00:00.000Z");
    expect(readStoredOfflineGame("online-abc", storage).save?.pendingMove).to.equal(undefined);
    expect(
      listOfflineGames(storage).games.map((game) => game.id),
      "one listed record, not one per save"
    ).to.deep.equal(["online-abc"]);
    expect(offlineGameListRow(updated.save!).mirror_of).to.equal("abc");

    expect(upsertStoredOfflineGame("online-abc", { nope: true }, "Copper Nova", { of: "abc" }, storage).error).to.equal(
      "That game state cannot be stored offline."
    );
    expect(
      upsertStoredOfflineGame("not a valid id", JSON.parse(JSON.stringify(engine)), "X", null, storage).error
    ).to.equal("The offline game id is invalid.");
  });

  it("exports a versioned backup and imports it as a new game without overwriting the original", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 offline-backup"], { lostFleet: true });
    const created = createStoredOfflineGame(engine, "Copper Nova", storage, Date.UTC(2026, 6, 17, 10), "backup-source");
    if (!created.save) {
      throw new Error(created.error ?? "Expected a stored offline game");
    }
    writeStoredOfflineGame(created.save.id, engine, "p1 faction terrans", storage, Date.UTC(2026, 6, 17, 11));
    const source = readStoredOfflineGame(created.save.id, storage).save;
    if (!source) {
      throw new Error("Expected the source game");
    }

    const raw = serializeOfflineGameBackup(source, Date.UTC(2026, 6, 17, 12));
    const imported = importOfflineGameBackup(raw, "ignored filename", storage, Date.UTC(2026, 6, 18, 9), "backup-copy");

    expect(imported.error).to.equal(null);
    expect(imported.save?.id).to.equal("backup-copy");
    expect(imported.save?.name).to.equal("Copper Nova");
    expect(imported.save?.pendingMove).to.equal(undefined);
    expect(imported.save?.engineData.moveHistory).to.include("p1 faction terrans");
    expect(imported.save?.savedAt).to.equal("2026-07-18T09:00:00.000Z");
    expect(readStoredOfflineGame("backup-source", storage).save).to.not.equal(null);
    expect(listOfflineGames(storage).games.map((game) => game.id)).to.deep.equal(["backup-copy", "backup-source"]);
  });

  it("imports raw engine JSON from the older in-game Export dialog", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 3 raw-json-backup"], { lostFleet: true });

    const imported = importOfflineGameBackup(
      JSON.stringify(engine),
      "Friday fleet night",
      storage,
      Date.UTC(2026, 6, 18, 10),
      "raw-json-copy"
    );

    expect(imported.error).to.equal(null);
    expect(imported.save?.name).to.equal("Friday fleet night");
    expect(imported.save?.engineData.moveHistory).to.deep.equal(engine.moveHistory);
  });

  it("rejects malformed and unsupported backups without changing the library", () => {
    const storage = new MemoryStorage();

    expect(importOfflineGameBackup("not-json", "Broken", storage).error).to.equal("That backup is not valid JSON.");
    expect(importOfflineGameBackup(JSON.stringify({ version: 99 }), "Broken", storage).error).to.equal(
      "That file does not contain a supported offline game backup."
    );
    expect(listOfflineGames(storage).games).to.have.length(0);
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

  it("recovers the real seed from the stored init line, not a nonexistent engine field", () => {
    // The engine has no top-level `seed` field, and SpaceMap.toJSON() deliberately drops its own
    // runtime `.seed` too - the only place a seed survives a JSON round trip is as plain text in
    // moveHistory[0] ("init <players> <seed>").
    const storage = new MemoryStorage();
    const engine = new Engine(["init 3 my-test-seed"], {});
    engine.generateAvailableCommandsIfNeeded();
    const stored = createStoredOfflineGame(engine, "Seed Check", storage, Date.now(), "seed-check");
    if (!stored.save) {
      throw new Error(stored.error ?? "setup failed");
    }

    expect(offlineGameListRow(stored.save).seed).to.equal("my-test-seed");
  });
});
