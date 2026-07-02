import { expect } from "chai";
import { engineOptions, HostedGameHost, initMoveLine, seatToLock } from "./host";
import { CommitTurnArgs, GameRow, HostedBackend, MoveRow, PlayerRow } from "./types";

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
    };
}

function playerRows(): PlayerRow[] {
  return [
    { game_id: "game-1", seat: 0, invited_email: "alice@example.com", user_id: "user-alice", display_name: "Alice" },
    { game_id: "game-1", seat: 1, invited_email: "bob@example.com", user_id: null, display_name: "Bob" },
  ];
}

class FakeBackend implements HostedBackend {
  moves: MoveRow[] = [];
  commits: CommitTurnArgs[] = [];
  fetchMovesCalls = 0;
  failNextCommitWith: string | null = null;

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

  async commitTurn(args: CommitTurnArgs): Promise<void> {
    if (this.failNextCommitWith) {
      const message = this.failNextCommitWith;
      this.failNextCommitWith = null;
      throw new Error(message);
    }
    if (args.seq !== this.moves.length + 1) {
      throw new Error(`seq_conflict: expected ${this.moves.length + 1}, got ${args.seq}`);
    }
    this.commits.push(args);
    this.moves.push({ game_id: args.gameId, seq: args.seq, seat: args.seat, move: args.move });
    this.game.move_count = args.seq;
    this.game.current_seat = args.nextSeat;
  }
}

function makeHost(backend: FakeBackend) {
  const states: any[] = [];
  const errors: string[] = [];
  const host = new HostedGameHost(backend, "game-1", {
    onState: (data) => states.push(data),
    onError: (message) => errors.push(message),
  });
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
    expect(host.committedMoveCount).to.equal(1);
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

  it("resyncs from the stored log when the backend rejects a commit", async () => {
    const backend = new FakeBackend(gameRow(), playerRows());
    backend.seedMoves(SETUP_MOVES.slice(0, 2));
    const { host, errors } = makeHost(backend);
    await host.load();

    // Another client committed move 3 behind our back:
    backend.moves.push({ game_id: "game-1", seq: 3, seat: 0, move: SETUP_MOVES[2] });
    backend.failNextCommitWith = "seq_conflict: expected 4, got 3";

    const fetchesBefore = backend.fetchMovesCalls;
    await host.submitMove("terrans build m -1x2");

    expect(errors).to.have.length(1);
    expect(backend.fetchMovesCalls).to.equal(fetchesBefore + 1);
    // after resync the engine includes the move the other client committed
    expect(host.committedMoveCount).to.equal(3);
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
});
