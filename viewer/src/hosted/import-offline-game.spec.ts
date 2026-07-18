import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { createStoredOfflineGame } from "../offline-game";
import { buildImportGameParams, deriveImportedMoveRows } from "./import-offline-game";

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

// Known-valid engine fixture (engine/src/engine.spec.ts "should allow players to upgrade a mine to
// a TS", also reused by host.spec.ts) - seed "randomSeed", 2 players, base game. Confirmed by direct
// replay: playerToMove before each of these 8 moves is [0,1,0,1,1,0,1,0] (nevlas places both its
// starting mines back-to-back before terrans places its second).
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

describe("deriveImportedMoveRows", () => {
  it("assigns each move to the seat that was actually on turn when it was played", () => {
    const rows = deriveImportedMoveRows("randomSeed", 2, {}, ["init 2 randomSeed", ...SETUP_MOVES]);

    expect(rows.map((r) => r.seat)).to.deep.equal([0, 1, 0, 1, 1, 0, 1, 0]);
    expect(rows.map((r) => r.seq)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.map((r) => r.move)).to.deep.equal(SETUP_MOVES);
  });

  it("replays the engine's own canonical (annotated) history just as well as raw input text", () => {
    // A restored offline save's engineData.moveHistory holds whatever .move() itself pushed
    // (createMoveToShow's resource-delta annotation included, e.g. "p2 faction nevlas (0/0/0/0 ⇒
    // 2/4/0/0)"), never the original pre-annotation text a player typed - confirmed by replaying
    // SETUP_MOVES here and reading the result back off a real Engine, rather than assumed.
    const probe = new Engine(["init 2 randomSeed", ...SETUP_MOVES], {});
    probe.generateAvailableCommandsIfNeeded();
    const annotatedHistory = probe.moveHistory;
    expect(annotatedHistory[2]).to.not.equal(SETUP_MOVES[1]);

    const rows = deriveImportedMoveRows("randomSeed", 2, {}, annotatedHistory);
    expect(rows.map((r) => r.seat)).to.deep.equal([0, 1, 0, 1, 1, 0, 1, 0]);
    expect(rows.map((r) => r.move)).to.deep.equal(annotatedHistory.slice(1));
  });

  it("drops a baked-in map from options before replay (offline-created games mutate the object in place)", () => {
    const probe = new Engine(["init 2 lost-fleet-space-map"], {
      lostFleet: true,
      advancedRules: true,
      factionVariant: "standard",
    });
    const mutatedOptions = JSON.parse(JSON.stringify(probe)).options;
    expect(mutatedOptions.map).to.exist;

    expect(() =>
      deriveImportedMoveRows("lost-fleet-space-map", 2, mutatedOptions, ["init 2 lost-fleet-space-map"])
    ).to.not.throw();
  });
});

describe("buildImportGameParams", () => {
  it("builds import_offline_game RPC params from a stored offline game", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 randomSeed", ...SETUP_MOVES], {});
    engine.generateAvailableCommandsIfNeeded();
    const stored = createStoredOfflineGame(engine, "Copper Nova", storage, Date.UTC(2026, 6, 18, 10), "offline-1");
    if (!stored.save) {
      throw new Error(stored.error ?? "setup failed");
    }

    const params = buildImportGameParams(stored.save, [
      { seat: 0, userId: "user-alice", displayName: "Alice" },
      { seat: 1, userId: "user-bob", displayName: "Bob" },
    ]);

    expect(params.p_name).to.equal("Copper Nova");
    expect(params.p_seed).to.equal("randomSeed");
    expect(params.p_player_count).to.equal(2);
    // Not {} - the constructor bakes in defaults (factionVariant/factionVariantVersion) the moment
    // it's built, same as any other engine; only the generated `map` placement itself is stripped.
    expect(params.p_options).to.deep.equal({ factionVariant: "standard", factionVariantVersion: 0 });
    expect(params.p_invites).to.deep.equal([
      { user_id: "user-alice", seat: 0, display_name: "Alice" },
      { user_id: "user-bob", seat: 1, display_name: "Bob" },
    ]);
    expect(params.p_moves.map((m) => m.seat)).to.deep.equal([0, 1, 0, 1, 1, 0, 1, 0]);
    expect(params.p_moves).to.have.length(8);
    expect(params.p_finished).to.equal(false);
    expect(params.p_current_seat).to.equal(0);
    expect(params.p_current_round).to.equal(1);
    expect(params.p_latest_move_summary).to.equal("terrans booster booster3");
  });
});
