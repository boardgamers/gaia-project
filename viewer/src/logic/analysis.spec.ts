import Engine, { Command, Phase } from "@gaia-project/engine";
import { expect } from "chai";
import {
  AnalysisEntry,
  applySoloRoundFlow,
  computeAnalysisCounter,
  grantSandboxWallet,
  loadAnalysisLine,
  markAnalysisSeat,
  replayAnalysisLine,
  resolveOpponentDecisions,
  saveAnalysisLine,
  stripCappedPass,
} from "./analysis";

// Same fixture as premove-preview.spec.ts: after these moves it's terrans' (seat 0) turn.
const SETUP_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
  "nevlas build m 0x-4",
  "terrans build m -4x-1",
  "nevlas booster booster7",
  "terrans booster booster3",
];

// Same fixture, one move short - terrans still owes their own booster pick (Phase.SetupBooster),
// so this is mid-setup rather than already at Phase.RoundMove.
const PARTIAL_SETUP_MOVES = SETUP_MOVES.slice(0, -1);

describe("replayAnalysisLine", () => {
  it("replays a legal line onto a fresh clone of the origin", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans up nav." }];
    const { engine, applied } = replayAnalysisLine(origin, entries, 0, 1, null);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("stops at the first entry that has gone illegal, keeping the valid prefix", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans build m 99x99." },
      { kind: "move", move: "nevlas up nav." },
    ];
    const { engine, applied } = replayAnalysisLine(origin, entries, 0, 1, null);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("leaves the original engine untouched", () => {
    const origin = new Engine(SETUP_MOVES);
    const before = JSON.stringify(origin);
    replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0, 1, null);
    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("returns the origin itself, unmodified, for an empty line", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine, applied, snapshots } = replayAnalysisLine(origin, [], 0, 1, null);
    expect(applied).to.equal(0);
    expect(engine.moveHistory).to.deep.equal(origin.moveHistory);
    expect(snapshots).to.deep.equal([]);
  });

  it("marks the seat's player data uncapped on the replayed engine", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0, 1, null);
    expect(engine.players[0].data.analysis).to.equal(true);
  });

  it("collects one resource snapshot per successfully applied entry, matching the resulting engine", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine, snapshots } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0, 1, null);
    expect(snapshots).to.have.length(1);
    expect(snapshots[0].credits).to.equal(engine.players[0].data.credits);
    expect(snapshots[0].knowledge).to.equal(engine.players[0].data.knowledge);
  });

  describe("lazy wallet grant for a setup-phase entry (Phase 4, §3.1)", () => {
    it("stays null while the line is still in setup", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0); // pre-seeds passedPlayers, mirroring enterAnalysisMode
      expect(origin.phase).to.not.equal(Phase.RoundMove);

      const { wallet } = replayAnalysisLine(origin, [], 0, 1, null);

      expect(wallet).to.equal(null);
    });

    it("grants the wallet the moment the line's own pass-and-play reaches round 1's RoundMove", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans booster booster3" }]; // last setup move

      const { engine, wallet } = replayAnalysisLine(origin, entries, 0, 1, null);

      expect(engine.phase).to.equal(Phase.RoundMove);
      expect(engine.round).to.equal(1);
      expect(wallet).to.not.equal(null);
      expect(engine.players[0].data.credits).to.be.at.least(30);
    });

    it("keeps the already-granted wallet across a later replay instead of re-granting", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const first = replayAnalysisLine(origin, [{ kind: "move", move: "terrans booster booster3" }], 0, 1, null);

      const second = replayAnalysisLine(
        origin,
        [{ kind: "move", move: "terrans booster booster3" }],
        0,
        1,
        first.wallet
      );

      expect(second.wallet).to.deep.equal(first.wallet);
    });
  });
});

describe("applySoloRoundFlow", () => {
  it("shrinks turnOrder to just the seat and resets passedPlayers fresh, without touching engine.setup", () => {
    const engine = new Engine(SETUP_MOVES);
    expect(engine.phase).to.equal(Phase.RoundMove);
    const realSetup = [...engine.setup];

    applySoloRoundFlow(engine, 0);

    expect(engine.turnOrder).to.deep.equal([0]);
    // Empty, not [0] - passedPlayers is also the CURRENT round's live accumulator (movePass pushes
    // onto it), so seeding it non-empty here would double-count this seat's own next pass.
    expect(engine.passedPlayers).to.deep.equal([]);
    expect(engine.currentPlayer).to.equal(0);
    expect(engine.setup).to.deep.equal(realSetup); // untouched - see beginLeechingPhase note
  });

  it("makes a solo pass loop back into RoundMove for the next round via real engine phase transitions", () => {
    const engine = new Engine(SETUP_MOVES);
    applySoloRoundFlow(engine, 0);
    const cmd = engine.findAvailableCommand(0, Command.Pass);
    const booster = cmd.data.boosters[0];

    engine.move(`terrans pass ${booster}`);

    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.round).to.equal(2);
    expect(engine.turnOrder).to.deep.equal([0]); // self-sustaining, no re-expansion to both seats
  });

  it("leaves turnOrder untouched during setup (pass-and-play, §2.6), only pre-seeding passedPlayers", () => {
    const engine = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    expect(engine.phase).to.not.equal(Phase.RoundMove);
    const realTurnOrder = [...engine.turnOrder];

    applySoloRoundFlow(engine, 0);

    expect(engine.turnOrder).to.deep.equal(realTurnOrder); // untouched - real setup order stays
    expect(engine.passedPlayers).to.deep.equal([0]); // takes effect later, at round 1's own transition
  });

  it("the setup pre-seed correctly resolves beginRoundStartPhase's fallback once round 1 begins", () => {
    const engine = new Engine(SETUP_MOVES.slice(0, -1)); // terrans still owes their own booster pick
    applySoloRoundFlow(engine, 0);

    engine.move("terrans booster booster3"); // completes setup -> triggers beginRoundStartPhase

    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.round).to.equal(1);
    expect(engine.turnOrder).to.deep.equal([0]); // passedPlayers=[0] resolved the fallback, not the real 2p list
  });
});

describe("stripCappedPass", () => {
  it("keeps Pass available in the current round", () => {
    const engine = new Engine(SETUP_MOVES);
    applySoloRoundFlow(engine, 0);
    stripCappedPass(engine, engine.round);
    expect(engine.availableCommands.some((c) => c.name === Command.Pass)).to.equal(true);
  });

  it("removes Pass once the line has advanced into its one bonus round", () => {
    const engine = new Engine(SETUP_MOVES);
    applySoloRoundFlow(engine, 0);
    const baseRound = engine.round; // 1
    const cmd = engine.findAvailableCommand(0, Command.Pass);
    engine.move(`terrans pass ${cmd.data.boosters[0]}`); // -> round 2, the one bonus round
    engine.generateAvailableCommandsIfNeeded();

    stripCappedPass(engine, baseRound);

    expect(engine.availableCommands.some((c) => c.name === Command.Pass)).to.equal(false);
  });
});

describe("resolveOpponentDecisions", () => {
  it("does nothing when it is already the analysis seat's turn", () => {
    const engine = new Engine(SETUP_MOVES);
    const before = JSON.stringify(engine);
    resolveOpponentDecisions(engine, 0);
    expect(JSON.stringify(engine)).to.equal(before);
  });

  it("auto-resolves an opponent's leech decision so control returns to the analysis seat", () => {
    // Same fixture as engine.spec.ts's "while the round is paused on a leech decision" - upgrading
    // the existing terrans mine to a trading station offers Nevlas a leech, genuinely pausing the
    // engine on Phase.RoundLeech. applySoloRoundFlow first, matching the real pipeline
    // (replayAnalysisLine applies it once at entry) - it's what makes "next player" resolve back to
    // the analysis seat once the leech decision clears, exactly like a real solo round would.
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    origin.player(0).data.credits = 20;
    origin.player(0).data.ores = 20;
    origin.move("terrans build ts -1x2.");
    origin.generateAvailableCommandsIfNeeded();
    expect(origin.phase).to.equal(Phase.RoundLeech);
    expect(origin.playerToMove).to.equal(1);

    resolveOpponentDecisions(origin, 0);

    expect(origin.playerToMove).to.equal(0);
    expect(origin.phase).to.equal(Phase.RoundMove);
  });
});

describe("markAnalysisSeat", () => {
  it("sets the analysis flag on the given seat's player data", () => {
    const engine = new Engine(SETUP_MOVES);
    markAnalysisSeat(engine, 0);
    expect(engine.players[0].data.analysis).to.equal(true);
    expect(engine.players[1].data.analysis).to.equal(false);
  });
});

describe("grantSandboxWallet", () => {
  it("grants a generous wallet and records the added amount as grant", () => {
    const engine = new Engine(SETUP_MOVES);
    const before = engine.players[0].data.credits;
    const wallet = grantSandboxWallet(engine, 0);
    expect(engine.players[0].data.analysis).to.equal(true);
    expect(wallet.baseline.credits).to.equal(before);
    expect(engine.players[0].data.credits).to.equal(before + wallet.grant.credits);
    expect(engine.players[0].data.credits).to.be.at.least(30);
  });

  it("never reduces a resource that already exceeds the sandbox target (e.g. qics)", () => {
    const engine = new Engine(SETUP_MOVES);
    engine.players[0].data.qics = 20; // above the 10-qic sandbox target
    const wallet = grantSandboxWallet(engine, 0);
    expect(wallet.grant.qics).to.equal(0);
    expect(engine.players[0].data.qics).to.equal(20);
  });
});

describe("computeAnalysisCounter", () => {
  it("shows zero net and the baseline as displayed value when nothing has been spent", () => {
    const engine = new Engine(SETUP_MOVES);
    const before = { ...engine.players[0].data };
    const wallet = grantSandboxWallet(engine, 0);
    const counter = computeAnalysisCounter(engine.players[0].data, wallet, []);
    expect(counter.credits.net).to.equal(0);
    expect(counter.credits.displayed).to.equal(before.credits);
    expect(counter.feasible).to.equal(true);
    expect(counter.infeasibleFromMove).to.equal(null);
  });

  it("goes negative (in red) once the line spends more than the real baseline held (§4.2 example)", () => {
    const engine = new Engine(SETUP_MOVES);
    engine.players[0].data.credits = 3;
    const wallet = grantSandboxWallet(engine, 0); // baseline.credits = 3, grant = 27 (target 30)
    engine.players[0].data.credits -= 10; // spend 10 from the granted wallet -> 20
    const snapshot = { ...engine.players[0].data };
    const counter = computeAnalysisCounter(snapshot, wallet, [snapshot]);
    expect(counter.credits.net).to.equal(-10);
    expect(counter.credits.displayed).to.equal(-7);
    expect(counter.feasible).to.equal(false);
    expect(counter.infeasibleFromMove).to.equal(1);
  });

  it("reports the power bowl state before/after, grant-adjusted back to real numbers", () => {
    const engine = new Engine(SETUP_MOVES);
    const wallet = grantSandboxWallet(engine, 0);
    const before = wallet.baseline.power;
    const counter = computeAnalysisCounter(engine.players[0].data, wallet, []);
    expect(counter.power.before).to.deep.equal(before);
    expect(counter.power.after).to.deep.equal(before);
  });
});

describe("analysis line persistence", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a saved line for the same seat", () => {
    const line = {
      entries: [{ kind: "move", move: "terrans up nav." }] as AnalysisEntry[],
      baseRound: 1,
      baseMoveCount: 9,
    };
    saveAnalysisLine(0, line);
    expect(loadAnalysisLine(0)).to.deep.equal(line);
  });

  it("keeps different seats' lines separate", () => {
    saveAnalysisLine(0, { entries: [], baseRound: 1, baseMoveCount: 9 });
    expect(loadAnalysisLine(1)).to.equal(null);
  });

  it("returns null when nothing is stored", () => {
    expect(loadAnalysisLine(0)).to.equal(null);
  });
});
