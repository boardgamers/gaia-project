import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { AutoDecideConfig, engineOptions, HostedGameHost, initMoveLine, latestMoveSummary, seatToLock } from "./host";
import {
  CommitTurnArgs,
  GameRow,
  HostedBackend,
  MoveRow,
  PlayerRow,
  PremoveFailureRow,
  PremoveMode,
  PremoveRow,
} from "./types";

// Committed-turn lines from a known-valid engine fixture
// (engine/src/engine.spec.ts "should allow players to upgrade a mine to a TS").
// Seed "randomSeed", 2 players, base game. After SETUP_MOVES the next turn is
// terrans' "build ts -1x2." which triggers a leech decision for nevlas — the
// §J2 out-of-order interrupt case.
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

function gameRow(): GameRow {
  return {
    id: "game-1",
    name: "Test game",
    seed: "randomSeed",
    player_count: 2,
    options: {},
    status: "active",
    current_seat: 0,
    move_count: 0,
    current_round: null,
    latest_move_summary: null,
  };
}

function lostFleetGameRow(): GameRow {
  return {
    ...gameRow(),
    seed: "lost-fleet-space-map",
    player_count: 2,
    options: { lostFleet: true, advancedRules: true, factionVariant: "standard" },
  };
}

function playerRows(): PlayerRow[] {
  return [
    { game_id: "game-1", seat: 0, invited_email: "alice@example.com", user_id: "user-alice", display_name: "Alice", faction: null, score: null },
    { game_id: "game-1", seat: 1, invited_email: "bob@example.com", user_id: null, display_name: "Bob", faction: null, score: null },
  ];
}

class FakeBackend implements HostedBackend {
  moves: MoveRow[] = [];
  commits: CommitTurnArgs[] = [];
  fetchMovesCalls = 0;
  failNextCommitWith: string | null = null;
  claimMySeatsCalls = 0;
  repairMoveCountCalls = 0;
  premoves: PremoveRow[] = [];
  premoveFailures: PremoveFailureRow[] = [];
  commitUsesGameMoveCount = false;
  private nextFailureId = 1;

  constructor(private game: GameRow, private players: PlayerRow[]) {}

  seedMoves(moves: string[]) {
    this.moves = moves.map((move, i) => ({ game_id: this.game.id, seq: i + 1, seat: 0, move }));
    this.game.move_count = this.moves.length;
  }

  async fetchGame(): Promise<GameRow> {
    return { ...this.game };
  }

  async fetchPlayers(): Promise<PlayerRow[]> {
    return this.players.map((p) => ({ ...p }));
  }

  async fetchMoves(): Promise<MoveRow[]> {
    this.fetchMovesCalls++;
    return this.moves.map((m) => ({ ...m }));
  }

  async claimMySeats(): Promise<void> {
    this.claimMySeatsCalls++;
  }

  async repairMoveCount(): Promise<number> {
    this.repairMoveCountCalls++;
    this.game.move_count = this.moves.length;
    return this.game.move_count;
  }

  async commitTurn(args: CommitTurnArgs): Promise<void> {
    if (this.failNextCommitWith) {
      const message = this.failNextCommitWith;
      this.failNextCommitWith = null;
      throw new Error(message);
    }
    const expectedSeq = (this.commitUsesGameMoveCount ? this.game.move_count : this.moves.length) + 1;
    if (args.seq !== expectedSeq) {
      throw new Error(`seq_conflict: expected ${expectedSeq}, got ${args.seq}`);
    }
    this.commits.push(args);
    this.moves.push({ game_id: args.gameId, seq: args.seq, seat: args.seat, move: args.move });
    this.game.move_count = args.seq;
    this.game.current_seat = args.nextSeat;
  }

  async fetchPremoves(): Promise<PremoveRow[]> {
    return this.premoves.map((p) => ({ ...p }));
  }

  async fetchPremoveFailures(): Promise<PremoveFailureRow[]> {
    return this.premoveFailures.filter((f) => f.read_at === null).map((f) => ({ ...f }));
  }

  async queuePremove(_gameId: string, seat: number, move: string, mode: PremoveMode): Promise<number> {
    const forSeat = this.premoves.filter((p) => p.seat === seat);
    if (forSeat.length > 0 && forSeat[0].mode !== mode) {
      throw new Error(`mode_mismatch: seat's queue is already in ${forSeat[0].mode} mode`);
    }
    if (forSeat.length >= 3) {
      throw new Error("queue is full (max 3)");
    }
    const seq = (forSeat.length ? forSeat[forSeat.length - 1].seq : 0) + 1;
    this.premoves.push({ seat, seq, move, mode, queued_move_count: this.moves.length });
    return seq;
  }

  async cancelPremove(_gameId: string, seat: number, seq: number): Promise<void> {
    this.premoves = this.premoves.filter((p) => !(p.seat === seat && p.seq === seq));
  }

  async cancelAllPremoves(_gameId: string, seat: number): Promise<void> {
    this.premoves = this.premoves.filter((p) => p.seat !== seat);
  }

  // Mirrors 0014_premove_edit.sql: update in place, cascading downstream deletes for Sequential.
  async editPremove(_gameId: string, seat: number, seq: number, move: string): Promise<void> {
    const row = this.premoves.find((p) => p.seat === seat && p.seq === seq);
    if (!row) {
      throw new Error("no premove queued at that position");
    }
    row.move = move;
    if (row.mode === "sequential") {
      this.premoves = this.premoves.filter((p) => !(p.seat === seat && p.seq > seq));
    }
  }

  async reorderPremove(_gameId: string, seat: number, seq: number, direction: "up" | "down"): Promise<void> {
    const forSeat = this.premoves.filter((p) => p.seat === seat).sort((a, b) => a.seq - b.seq);
    const i = forSeat.findIndex((p) => p.seq === seq);
    if (i === -1) {
      throw new Error("no such queued premove");
    }
    if (forSeat[i].mode !== "priority") {
      throw new Error("reordering only applies to a priority queue");
    }
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= forSeat.length) {
      return;
    }
    const a = forSeat[i].seq;
    const b = forSeat[j].seq;
    forSeat[i].seq = b;
    forSeat[j].seq = a;
  }

  async markPremoveFailureRead(id: string): Promise<void> {
    const failure = this.premoveFailures.find((f) => f.id === id);
    if (failure) {
      failure.read_at = new Date().toISOString();
    }
  }

  autoCharge: Record<number, string> = {};
  failNextSetAutoChargeWith: string | null = null;

  async setAutoCharge(_gameId: string, seat: number, pref: string): Promise<void> {
    if (this.failNextSetAutoChargeWith) {
      const message = this.failNextSetAutoChargeWith;
      this.failNextSetAutoChargeWith = null;
      throw new Error(message);
    }
    this.autoCharge[seat] = pref;
  }

  // Test helper mirroring what resolve-automation (or a genuinely failed fast-path) would do.
  seedPremoveFailure(seat: number, move: string, reason: string): void {
    this.premoveFailures.push({ id: String(this.nextFailureId++), seat, move, reason, read_at: null });
  }
}

function makeHost(backend: FakeBackend, autoDecide?: AutoDecideConfig) {
  const states: any[] = [];
  const errors: string[] = [];
  const host = new HostedGameHost(
    backend,
    "game-1",
    {
      onState: (data) => states.push(data),
      onError: (message) => errors.push(message),
    },
    autoDecide
  );
  return { host, states, errors };
}

describe("seat locking rule", () => {
  it("locks a single-seat player to their seat, whoever is on turn", () => {
    expect(seatToLock([1], 2, 1)).to.equal(1);
    expect(seatToLock([1], 2, 0)).to.equal(1);
  });

  it("unlocks whichever owned seat must act for a player holding several seats", () => {
    expect(seatToLock([0, 2], 4, 2)).to.equal(2);
    expect(seatToLock([0, 2], 4, 0)).to.equal(0);
    // an unowned seat is on turn: stay on the first owned seat (locked anyway)
    expect(seatToLock([0, 2], 4, 1)).to.equal(0);
  });

  it("does not lock at all when the user owns every seat (test game hot-seat)", () => {
    expect(seatToLock([0, 1], 2, 0)).to.equal(null);
    expect(seatToLock([0, 1, 2], 3, 2)).to.equal(null);
  });

  it("does not lock users with no seats (commit_turn rejects them server-side)", () => {
    expect(seatToLock([], 2, 0)).to.equal(null);
  });
});

describe("engine options sanitizing", () => {
  it("strips an engine-injected map without mutating the stored row", () => {
    const game = gameRow();
    game.options = { lostFleet: true, map: { sectors: [] } };
    expect(engineOptions(game)).to.deep.equal({ lostFleet: true });
    expect(game.options.map).to.deep.equal({ sectors: [] });
  });

  it("boots a legacy lostFleet game whose stored options contain a map", async () => {
    // Regression: create_game used to persist options the probe Engine had
    // mutated (it writes the generated map back), and init rejects a preset
    // map combined with lostFleet — making the game unopenable.
    const game = gameRow();
    game.options = { lostFleet: true, map: { mirror: false, sectors: [{ sector: "1", rotation: 0 }] } };
    const backend = new FakeBackend(game, playerRows());
    backend.seedMoves([]);
    const { host, states, errors } = makeHost(backend);

    await host.load();

    expect(errors).to.deep.equal([]);
    expect(states).to.have.length(1);
    expect(host.engine.moveHistory[0]).to.equal("init 2 randomSeed");
  });
});

describe("hosted game host", () => {
  it("builds the init line from the stored seed and player count", () => {
    expect(initMoveLine(gameRow())).to.equal("init 2 randomSeed");
  });

  it("replays the stored move log on load and stamps display names", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host, states } = makeHost(backend);

    await host.load();

    expect(host.committedMoveCount).to.equal(SETUP_MOVES.length);
    expect(host.engine.moveHistory[0]).to.equal("init 2 randomSeed");
    expect(host.engine.players[0].name).to.equal("Alice");
    expect(host.engine.players[1].name).to.equal("Bob");
    expect(states).to.have.length(1);
    expect(states[0].playerToMove).to.equal(host.engine.playerToMove);
  });

  it("re-claims seats on load before fetching the hosted game state", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host } = makeHost(backend);

    await host.load();

    expect(backend.claimMySeatsCalls).to.equal(1);
  });

  it("repairs a stale stored move_count on load before the first hosted commit", async () => {
    const backend = new FakeBackend(lostFleetGameRow(), playerRows());
    backend.commitUsesGameMoveCount = true;
    backend.seedMoves(["p2 rotate"]);
    backend.game.move_count = 0;
    const { host, errors } = makeHost(backend);

    await host.load();
    await host.submitMove("p1 faction terrans");

    expect(backend.repairMoveCountCalls).to.equal(1);
    expect(backend.commits).to.have.length(1);
    expect(backend.commits[0].seq).to.equal(2);
    expect(host.committedMoveCount).to.equal(2);
    expect(errors).to.deep.equal([]);
  });

  it("skips rebuilding/re-emitting on a resync that finds nothing new (spurious tab-foreground/reconnect resync)", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host, states } = makeHost(backend);
    await host.load();

    const engineBeforeResync = host.engine;
    expect(states).to.have.length(1);

    // Nothing changed server-side - this mirrors hosted.ts's visibilitychange listener firing on
    // every tab foreground, or a realtime channel reconnecting with no new moves in between.
    await host.resync();

    expect(states, "a no-op resync must not emit a new state").to.have.length(1);
    expect(host.engine, "a no-op resync must not replace the Engine object").to.equal(engineBeforeResync);
  });

  it("still rebuilds/re-emits on a resync that finds a real new move", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host, states } = makeHost(backend);
    await host.load();

    // Simulate another client/tab committing a move directly against the backend, bypassing this
    // host entirely (the scenario a resync is actually meant to catch up on). Per this file's
    // SETUP_MOVES doc comment, the next legal turn is terrans' "build ts -1x2.".
    backend.seedMoves([...SETUP_MOVES, "terrans build ts -1x2."]);

    await host.resync();

    expect(states, "a real change must still emit a new state").to.have.length(2);
    expect(host.committedMoveCount).to.equal(SETUP_MOVES.length + 1);
  });

  it("maps the session user to seats by user id and by invited email", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host } = makeHost(backend);
    await host.load();

    expect(host.mySeats("user-alice", null)).to.deep.equal([0]);
    expect(host.mySeats("someone-else", "Bob@Example.com")).to.deep.equal([1]);
    expect(host.mySeats("stranger", "nobody@example.com")).to.deep.equal([]);
  });

  it("commits a completed turn with the engine-derived seat and next seat", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves([]);
    const { host } = makeHost(backend);
    await host.load();

    const seatBefore = host.engine.playerToMove;
    await host.submitMove("p1 faction terrans");

    expect(backend.commits).to.have.length(1);
    const commit = backend.commits[0];
    expect(commit.seq).to.equal(1);
    expect(commit.seat).to.equal(seatBefore);
    expect(commit.move).to.equal("p1 faction terrans");
    expect(commit.finished).to.equal(false);
    expect(commit.nextSeat).to.equal(host.engine.playerToMove);
    expect(commit.latestMoveSummary).to.equal("P1 pick Terrans.");
    expect(host.committedMoveCount).to.equal(1);
  });

  it("re-claims seats and retries once when commit_turn says the seat is not yours", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves([]);
    backend.failNextCommitWith = "seat 0 is not yours";
    const { host, errors } = makeHost(backend);
    await host.load();

    await host.submitMove("p1 faction terrans");

    expect(backend.claimMySeatsCalls).to.equal(2);
    expect(backend.commits).to.have.length(1);
    expect(host.committedMoveCount).to.equal(1);
    expect(errors).to.deep.equal([]);
  });

  it("caches the current round and each faction-having seat's score on every commit (for the Lobby list)", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves([]);
    const { host } = makeHost(backend);
    await host.load();

    // Before any faction is picked, nothing has a faction yet - playerUpdates is empty rather
    // than sending half-formed entries.
    await host.submitMove("p1 faction terrans");
    expect(backend.commits[0].currentRound).to.equal(0);
    expect(backend.commits[0].playerUpdates).to.deep.equal([{ seat: 0, faction: "terrans", score: 10 }]);

    await host.submitMove("p2 faction nevlas");
    expect(backend.commits[1].playerUpdates).to.deep.equal([
      { seat: 0, faction: "terrans", score: 10 },
      { seat: 1, faction: "nevlas", score: 10 },
    ]);
  });

  it("commits an initial-mine setup turn cleanly during round 0", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(["p1 faction terrans", "p2 faction nevlas"]);
    const { host } = makeHost(backend);
    await host.load();

    await host.submitMove("terrans build m -1x2");

    expect(backend.commits).to.have.length(1);
    expect(backend.commits[0].move).to.equal("terrans build m -1x2");
    expect(host.engine.phase).to.equal("setupBuilding");
    expect(host.engine.playerToMove).to.equal(1);
  });

  it("optimistically advances a completed setup turn before the backend ack returns", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(["p1 faction terrans", "p2 faction nevlas"]);
    const { host, states } = makeHost(backend);
    await host.load();

    let releaseCommit!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const realCommitTurn = backend.commitTurn.bind(backend);
    (backend as any).commitTurn = async (args: CommitTurnArgs) => {
      await gate;
      return realCommitTurn(args);
    };

    const submit = host.submitMove("terrans build m -1x2");
    await Promise.resolve();

    expect(states[states.length - 1].phase).to.equal("setupBuilding");
    expect(states[states.length - 1].playerToMove).to.equal(1);
    expect(states[states.length - 1].moveHistory[states[states.length - 1].moveHistory.length - 1]).to.equal(
      "terrans build m -1x2"
    );

    releaseCommit();
    await submit;
  });

  it("compacts primary move summaries for the lobby row", async () => {
    const engine = new Engine(["init 2 randomSeed2", "p1 faction terrans", "p2 faction geodens"]);
    engine.generateAvailableCommandsIfNeeded();

    expect(latestMoveSummary(engine, "terrans up int.")).to.equal("Terrans up int.");
    expect(latestMoveSummary(engine, "terrans build m 8A2.")).to.equal("Terrans build mine sector 8.");
    expect(latestMoveSummary(engine, "terrans action power4.")).to.equal("Terrans power action 4.");
    expect(latestMoveSummary(engine, "terrans federation 1A4,9A9,9B4,9C fed4.")).to.equal("Terrans form fed.");
    expect(latestMoveSummary(engine, "terrans explore tfmars. endturn")).to.equal("Terrans explore tfmars.");
  });

  it("reports the leech decider as next seat when a build interrupts turn order (§J2)", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host } = makeHost(backend);
    await host.load();

    // terrans (seat 0) upgrades next to nevlas: the committed turn's
    // "who acts now" is nevlas' (seat 1) pending power-charge decision,
    // not simple round-robin.
    await host.submitMove("terrans build ts -1x2.");

    expect(backend.commits).to.have.length(1);
    expect(backend.commits[0].seat).to.equal(0);
    expect(backend.commits[0].nextSeat).to.equal(1);

    await host.submitMove("nevlas charge 1pw");
    expect(backend.commits).to.have.length(2);
    expect(backend.commits[1].seat).to.equal(1);
  });

  describe("auto leech", () => {
    it("auto-commits a leech interrupt for the local user's own seat, without a manual submitMove", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend, {
        isMySeat: (seat) => seat === 1, // this browser is nevlas (seat 1)
        getAutoChargePower: () => "decline-cost",
      });
      await host.load();

      // Triggers nevlas' leech interrupt; nevlas' own seat is auto-decidable, so it commits on
      // its own without any second submitMove call for it.
      await host.submitMove("terrans build ts -1x2.");

      expect(backend.commits).to.have.length(2);
      expect(backend.commits[0].nextSeat).to.equal(1);
      expect(backend.commits[1].seat).to.equal(1);
      expect(backend.commits[1].move).to.contain("charge");
    });

    it("never auto-decides for a seat the local user doesn't hold", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend, {
        isMySeat: (seat) => seat === 0, // this browser is terrans (seat 0), not nevlas
        getAutoChargePower: () => "decline-cost",
      });
      await host.load();

      await host.submitMove("terrans build ts -1x2.");

      // Only terrans' own build committed - nevlas' interrupt is left pending for nevlas' own
      // browser session to decide, exactly like before this feature existed.
      expect(backend.commits).to.have.length(1);
      expect(host.engine.playerToMove).to.equal(1);
    });

    it("does nothing when the preference is 'ask' (the default) even for the local user's own seat", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend, {
        isMySeat: () => true,
        getAutoChargePower: () => "ask",
      });
      await host.load();

      await host.submitMove("terrans build ts -1x2.");

      expect(backend.commits).to.have.length(1);
      expect(host.engine.playerToMove).to.equal(1);
    });

    it("auto-decides on load/resync too, not just after a manual submitMove", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      // The stored log already ends with the triggering build - the interrupt is pending the
      // moment this session loads, before any local submitMove happens.
      backend.seedMoves([...SETUP_MOVES, "terrans build ts -1x2."]);
      const { host } = makeHost(backend, {
        isMySeat: (seat) => seat === 1,
        getAutoChargePower: () => "decline-cost",
      });

      await host.load();

      expect(backend.commits).to.have.length(1);
      expect(backend.commits[0].seat).to.equal(1);
    });
  });

  it("rejects an illegal move locally without contacting the backend", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves([]);
    const { host, states, errors } = makeHost(backend);
    await host.load();

    await host.submitMove("p1 build m 0x0");

    expect(backend.commits).to.have.length(0);
    expect(errors).to.have.length(1);
    expect(host.committedMoveCount).to.equal(0);
    // the state was re-emitted so the UI recovers to the committed engine
    expect(states[states.length - 1].moveHistory).to.have.length(1);
  });

  it("silently resyncs (no error toast) on a seq_conflict rejection", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES.slice(0, 2));
    const { host, errors } = makeHost(backend);
    await host.load();

    // Another client committed move 3 behind our back:
    backend.moves.push({ game_id: "game-1", seq: 3, seat: 0, move: SETUP_MOVES[2] });
    backend.failNextCommitWith = "seq_conflict: expected 4, got 3";

    const fetchesBefore = backend.fetchMovesCalls;
    await host.submitMove("terrans build m -1x2");

    // seq_conflict means someone else already handled it - not alarming, so no error toast.
    expect(errors).to.deep.equal([]);
    expect(backend.fetchMovesCalls).to.equal(fetchesBefore + 1);
    // after resync the engine includes the move the other client committed
    expect(host.committedMoveCount).to.equal(3);
  });

  it("rebuilds on a seq_conflict even when the server move count matches the optimistic local count", async () => {
    const backend = new FakeBackend(lostFleetGameRow(), playerRows());
    backend.seedMoves(["p2 rotate"]);
    const { host, errors } = makeHost(backend);
    await host.load();

    // Another tab already landed the first faction pick at seq 2.
    backend.moves.push({ game_id: "game-1", seq: 2, seat: 0, move: "p1 faction terrans" });
    (backend as any).game.move_count = 2;
    backend.failNextCommitWith = "seq_conflict: expected 3, got 2";

    await host.submitMove("p1 faction hadsch-hallas");

    expect(errors).to.deep.equal([]);
    expect(host.committedMoveCount).to.equal(2);
    expect(host.engine.moveHistory.slice(1)).to.deep.equal(["p2 rotate", "p1 faction terrans"]);
    expect(host.engine.players[0].faction).to.equal("terrans");
  });

  it("still surfaces a genuine (non-seq_conflict) commit failure as an error", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves([]);
    const { host, errors } = makeHost(backend);
    await host.load();

    backend.failNextCommitWith = "network error: could not reach the server";
    await host.submitMove("p1 faction terrans");

    expect(errors).to.have.length(1);
    expect(errors[0]).to.contain("Could not save the turn");
  });

  it("applies a consecutive remote move incrementally", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES.slice(0, 2));
    const { host, states } = makeHost(backend);
    await host.load();

    const fetchesBefore = backend.fetchMovesCalls;
    await host.applyRemoteMove({ game_id: "game-1", seq: 3, seat: 0, move: SETUP_MOVES[2] });

    expect(host.committedMoveCount).to.equal(3);
    expect(backend.fetchMovesCalls).to.equal(fetchesBefore); // no refetch needed
    expect(states[states.length - 1].moveHistory).to.have.length(4);
  });

  it("skips remote echoes of already-applied moves", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES.slice(0, 3));
    const { host, states } = makeHost(backend);
    await host.load();

    const statesBefore = states.length;
    await host.applyRemoteMove({ game_id: "game-1", seq: 2, seat: 1, move: SETUP_MOVES[1] });

    expect(host.committedMoveCount).to.equal(3);
    expect(states.length).to.equal(statesBefore);
  });

  it("falls back to a full resync when a remote move leaves a gap", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES.slice(0, 2));
    const { host } = makeHost(backend);
    await host.load();

    // moves 3..5 happened while we were disconnected; only 5 arrives
    backend.seedMoves(SETUP_MOVES.slice(0, 5));
    const fetchesBefore = backend.fetchMovesCalls;
    await host.applyRemoteMove({ game_id: "game-1", seq: 5, seat: 1, move: SETUP_MOVES[4] });

    expect(backend.fetchMovesCalls).to.equal(fetchesBefore + 1);
    expect(host.committedMoveCount).to.equal(5);
  });

  it("never mutates the stored game options (Engine writes into the object it's given)", async () => {
    // Regression: Engine stamps the generated map layout into options.map;
    // if that mutated object is what's stored/kept, a Lost Fleet game can
    // never be replayed (moveInit rejects map.sectors + lostFleet).
    const game = { ...gameRow(), options: { lostFleet: true, factionVariant: "standard" } };
    const backend = new FakeBackend(game, playerRows());
    backend.seedMoves([]);
    const { host } = makeHost(backend);

    await host.load();
    expect(host.game.options).to.deep.equal({ lostFleet: true, factionVariant: "standard" });

    // and replaying again from the same stored options must still boot
    await host.resync();
    expect(host.game.options).to.deep.equal({ lostFleet: true, factionVariant: "standard" });
    expect(host.engine.moveHistory).to.have.length(1);
  });

  it("renders but does not persist an incomplete turn line", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES);
    const { host, states } = makeHost(backend);
    await host.load();

    // Missing the trailing "." that ends the turn: the engine reports an
    // incomplete move (newTurn=false), so nothing may reach the backend.
    await host.submitMove("terrans build ts -1x2");

    expect(backend.commits).to.have.length(0);
    expect(host.committedMoveCount).to.equal(SETUP_MOVES.length);
    // ...but the partial move WAS rendered for the local player:
    const rendered = states[states.length - 1];
    expect(rendered.moveHistory).to.have.length(SETUP_MOVES.length + 2);
    expect(rendered.newTurn).to.equal(false);
  });

  describe("premove", () => {
    // Terrans (seat 0) is about to build at 3B0, which triggers a leech decision for nevlas (seat
    // 1) before nevlas's real turn - the same §J2 interrupt fixture used elsewhere.
    const BUILD_TRIGGERING_LEECH = "terrans build m 3B0.";
    const NEVLAS_PREMOVE = "nevlas build m 1B0.";

    it("does not fire the queued premove while a leech decision is pending (Phase 1 has no auto-charge)", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend, {
        isMySeat: (seat) => seat === 1, // this browser is nevlas
        getAutoChargePower: () => "ask", // Phase 1: no auto-charge, so the leech waits for a human
      });
      await host.load();
      await host.queuePremove(1, NEVLAS_PREMOVE);

      await host.submitMove(BUILD_TRIGGERING_LEECH);

      // Only terrans' build committed - the leech is still pending, and the queued premove is left
      // untouched behind it rather than being (wrongly) played during Phase.RoundLeech.
      expect(backend.commits).to.have.length(1);
      expect(host.engine.phase).to.equal("roundLeech");
      expect(host.premoves).to.deep.equal([
        { seat: 1, seq: 1, move: NEVLAS_PREMOVE, mode: "sequential", queued_move_count: SETUP_MOVES.length },
      ]);
    });

    it("fires the fast-path the instant it's genuinely this seat's turn (Phase.RoundMove), and cleans up the row", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend, {
        isMySeat: (seat) => seat === 1,
        getAutoChargePower: () => "ask",
      });
      await host.load();
      await host.queuePremove(1, NEVLAS_PREMOVE);

      await host.submitMove(BUILD_TRIGGERING_LEECH);
      // A human (this same session) decides the leech manually - Phase 2 would auto-decide this;
      // Phase 1 doesn't, so it's a normal submitMove.
      await host.submitMove("nevlas decline");

      // The leech decline itself is one commit; the fast-path's own commit of the queued premove
      // is the next one, with no further submitMove call needed for it.
      expect(backend.commits).to.have.length(3);
      expect(backend.commits[1].move).to.equal("nevlas decline");
      expect(backend.commits[2].seat).to.equal(1);
      expect(backend.commits[2].move).to.equal(NEVLAS_PREMOVE);
      expect(host.premoves).to.deep.equal([]);
      expect(host.engine.playerToMove).to.equal(0);
    });

    it("leaves a since-illegal premove queued (not swallowed as an error) for the offline path to clean up", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host, errors } = makeHost(backend, {
        isMySeat: (seat) => seat === 1,
        getAutoChargePower: () => "ask",
      });
      await host.load();
      // Queue a move that is legal right now but will already have been played as this same
      // fixture's manual leech-decline turn by the time nevlas's real turn arrives - by then 1B0 is
      // no longer available the same way twice, but to keep this deterministic, queue something
      // straightforwardly illegal instead (nonsense coordinates).
      await host.queuePremove(1, "nevlas build m 99x99.");

      await host.submitMove(BUILD_TRIGGERING_LEECH);
      await host.submitMove("nevlas decline");

      // The fast-path swallowed the failure silently (no error toast) rather than surfacing
      // "Invalid move ...:" for something the user never typed - see applyAndCommit's doc comment.
      expect(errors).to.deep.equal([]);
      // Unlike a successful fast-path, a failed one leaves the row alone: the client doesn't
      // duplicate resolve-automation's own delete-and-record-failure bookkeeping.
      expect(host.premoves).to.have.length(1);
      expect(host.premoves[0].move).to.equal("nevlas build m 99x99.");
    });

    it("cancelPremove removes a queued entry", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend);
      await host.load();

      const seq1 = await backend.queuePremove("game-1", 1, NEVLAS_PREMOVE, "sequential");
      await host.load(); // re-fetch cached premove state the way a fresh page load would
      expect(host.premoves).to.have.length(1);

      await host.cancelPremove(1, seq1);

      expect(host.premoves).to.deep.equal([]);
    });

    it("editPremove updates a Sequential entry's move in place and cascades everything after it", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend);
      await host.load();

      const seq1 = await backend.queuePremove("game-1", 1, "nevlas build m 1B0.", "sequential");
      await backend.queuePremove("game-1", 1, "nevlas pass booster3", "sequential");
      await host.load();
      expect(host.premoves).to.have.length(2);

      await host.editPremove(1, seq1, NEVLAS_PREMOVE);

      expect(host.premoves).to.deep.equal([
        { seat: 1, seq: seq1, move: NEVLAS_PREMOVE, mode: "sequential", queued_move_count: SETUP_MOVES.length },
      ]);
    });

    it("editPremove updates a Priority entry in place without touching the other ranks", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend);
      await host.load();

      const seq1 = await backend.queuePremove("game-1", 1, "nevlas build m 1B0.", "priority");
      const seq2 = await backend.queuePremove("game-1", 1, "nevlas pass booster3", "priority");
      await host.load();

      await host.editPremove(1, seq2, NEVLAS_PREMOVE);

      const bySeq = [...host.premoves].sort((a, b) => a.seq - b.seq);
      expect(bySeq).to.deep.equal([
        { seat: 1, seq: seq1, move: "nevlas build m 1B0.", mode: "priority", queued_move_count: SETUP_MOVES.length },
        { seat: 1, seq: seq2, move: NEVLAS_PREMOVE, mode: "priority", queued_move_count: SETUP_MOVES.length },
      ]);
    });

    it("exposes unread premove failures and lets the client mark them read", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      backend.seedPremoveFailure(1, "nevlas build m 99x99.", "Impossible to execute build command");
      const { host } = makeHost(backend);

      await host.load();
      expect(host.premoveFailures).to.have.length(1);
      const id = host.premoveFailures[0].id;

      await host.markPremoveFailureRead(id);

      expect(host.premoveFailures).to.deep.equal([]);
    });

    it("setAutoCharge persists the preference for a seat (Phase 2)", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host } = makeHost(backend);
      await host.load();

      await host.setAutoCharge(1, "decline-cost");

      expect(backend.autoCharge).to.deep.equal({ 1: "decline-cost" });
    });

    it("setAutoCharge fails soft (reports an error, doesn't throw) so a save hiccup never blocks gameplay", async () => {
      const backend = new FakeBackend(gameRow(), playerRows());
      backend.seedMoves(SETUP_MOVES);
      const { host, errors } = makeHost(backend);
      await host.load();

      backend.failNextSetAutoChargeWith = "network error";
      await host.setAutoCharge(1, "decline-cost");

      expect(errors).to.have.length(1);
      expect(errors[0]).to.contain("auto-charge preference");
    });

    describe("Phase 3: multi-slot queues", () => {
      // "terrans up terra." hands turn straight to nevlas (seat 1) in Phase.RoundMove with no leech
      // interrupt, unlike BUILD_TRIGGERING_LEECH above - a cleaner fixture for exercising the
      // multi-slot resolver itself without an interleaved leech decision.
      const TERRANS_HANDS_OFF = "terrans up terra.";

      it("sequential: fires the head via the fast-path and leaves the rest queued for next time", async () => {
        const backend = new FakeBackend(gameRow(), playerRows());
        backend.seedMoves(SETUP_MOVES);
        const { host } = makeHost(backend, { isMySeat: (seat) => seat === 1, getAutoChargePower: () => "ask" });
        await host.load();
        await host.queuePremove(1, "nevlas up terra.", "sequential");
        await host.queuePremove(1, "nevlas pass booster4", "sequential");

        await host.submitMove(TERRANS_HANDS_OFF);

        expect(backend.commits).to.have.length(2);
        expect(backend.commits[1].move).to.equal("nevlas up terra.");
        expect(host.premoves).to.have.length(1);
        expect(host.premoves[0].move).to.equal("nevlas pass booster4");
        expect(host.engine.playerToMove).to.equal(0);
      });

      it("sequential: a cascade failure is left entirely for the offline path (client touches nothing)", async () => {
        const backend = new FakeBackend(gameRow(), playerRows());
        backend.seedMoves(SETUP_MOVES);
        const { host } = makeHost(backend, { isMySeat: (seat) => seat === 1, getAutoChargePower: () => "ask" });
        await host.load();
        await host.queuePremove(1, "nevlas build m 99x99.", "sequential");
        await host.queuePremove(1, "nevlas up terra.", "sequential");

        await host.submitMove(TERRANS_HANDS_OFF);

        // Only terrans' own move committed - the fast-path saw a "failed" resolution (the head threw,
        // which would cascade the second entry away too) and left both rows alone, same Phase 1
        // philosophy of never duplicating the edge function's failure bookkeeping on the client.
        expect(backend.commits).to.have.length(1);
        expect(host.premoves).to.have.length(2);
      });

      it("priority: skips an illegal rank 1, fires rank 2, clears the whole queue, and reports which rank fired", async () => {
        const backend = new FakeBackend(gameRow(), playerRows());
        backend.seedMoves(SETUP_MOVES);
        const played: { seat: number; move: string; rank?: number; totalRanks?: number }[] = [];
        const host = new HostedGameHost(
          backend,
          "game-1",
          { onState: () => undefined, onPremovePlayed: (seat, move, info) => played.push({ seat, move, ...info }) },
          { isMySeat: (seat) => seat === 1, getAutoChargePower: () => "ask" }
        );
        await host.load();
        await host.queuePremove(1, "nevlas build m 99x99.", "priority");
        await host.queuePremove(1, "nevlas up terra.", "priority");

        await host.submitMove(TERRANS_HANDS_OFF);

        expect(backend.commits).to.have.length(2);
        expect(backend.commits[1].move).to.equal("nevlas up terra.");
        expect(host.premoves).to.deep.equal([]);
        expect(played).to.deep.equal([{ seat: 1, move: "nevlas up terra.", rank: 2, totalRanks: 2 }]);
      });

      describe("reconciliation (§10.7)", () => {
        // isMySeat always false: the fast-path never fires for nevlas, simulating "the queue landed
        // (or didn't) some other way" so a manual submitMove for nevlas' own real turn is reachable
        // to test against, instead of the fast-path racing ahead of it.
        function noFastPathHost(backend: FakeBackend) {
          return makeHost(backend, { isMySeat: () => false, getAutoChargePower: () => "ask" });
        }

        it("pops just the matching head when a sequential premove's own move is submitted manually", async () => {
          const backend = new FakeBackend(gameRow(), playerRows());
          backend.seedMoves(SETUP_MOVES);
          const { host } = noFastPathHost(backend);
          await host.load();
          await host.queuePremove(1, "nevlas up terra.", "sequential");
          await host.queuePremove(1, "nevlas pass booster4", "sequential");

          await host.submitMove(TERRANS_HANDS_OFF);
          await host.submitMove("nevlas up terra.");

          expect(host.premoves).to.have.length(1);
          expect(host.premoves[0].move).to.equal("nevlas pass booster4");
        });

        it("clears the whole queue when a manual move does not match the sequential head", async () => {
          const backend = new FakeBackend(gameRow(), playerRows());
          backend.seedMoves(SETUP_MOVES);
          const { host } = noFastPathHost(backend);
          await host.load();
          await host.queuePremove(1, "nevlas up terra.", "sequential");

          await host.submitMove(TERRANS_HANDS_OFF);
          await host.submitMove("nevlas pass booster4");

          expect(host.premoves).to.deep.equal([]);
        });

        it("clears the whole queue on a manual pass even when it exactly matches a sequential head", async () => {
          const backend = new FakeBackend(gameRow(), playerRows());
          backend.seedMoves(SETUP_MOVES);
          const { host } = noFastPathHost(backend);
          await host.load();
          await host.queuePremove(1, "nevlas pass booster4", "sequential");
          await host.queuePremove(1, "nevlas up terra.", "sequential");

          await host.submitMove(TERRANS_HANDS_OFF);
          await host.submitMove("nevlas pass booster4");

          // A pass ends the round for this seat - the whole queue clears, not just the matched head.
          expect(host.premoves).to.deep.equal([]);
        });

        it("does not reconcile a leech decision made for the same seat (not the seat's real turn)", async () => {
          const backend = new FakeBackend(gameRow(), playerRows());
          backend.seedMoves(SETUP_MOVES);
          const { host } = noFastPathHost(backend);
          await host.load();
          await host.queuePremove(1, "nevlas up terra.", "sequential");

          // terrans' Trading Station upgrade triggers a leech decision for nevlas BEFORE nevlas' real
          // RoundMove turn - deciding it manually must not touch the queued premove.
          await host.submitMove("terrans build ts -1x2.");
          await host.submitMove("nevlas decline");

          expect(host.premoves).to.have.length(1);
          expect(host.premoves[0].move).to.equal("nevlas up terra.");
        });
      });
    });
  });
});
