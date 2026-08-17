import Engine, { AuctionVariant, Command, Faction, Phase, Round } from "@gaia-project/engine";
import { expect } from "chai";
import {
  AnalysisEntry,
  analysisFactionPool,
  applyFactionSeed,
  applySoloRoundFlow,
  buildAnalysisLineup,
  clearAnalysisLine,
  committableAnalysisMoves,
  computeAnalysisCounter,
  factionSeedAvailable,
  grantSandboxWallet,
  loadAnalysisLine,
  MAX_COMMITTABLE_MOVES,
  markAnalysisSeat,
  moveBelongsToSeat,
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

    it("re-applies the same grant on every later replay, since the origin never carries it", () => {
      // Regression: keying the grant off "no wallet yet" meant the caller feeding its kept wallet
      // back in as initialWallet suppressed it from the second replay onwards - the clone silently
      // reverted to the seat's real resources while the counter kept subtracting a grant that was
      // no longer applied, so every number in a setup-started line was wrong from its second edit.
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans booster booster3" }];
      const first = replayAnalysisLine(origin, entries, 0, 1, null);

      const second = replayAnalysisLine(origin, entries, 0, 1, first.wallet);

      expect(second.wallet).to.deep.equal(first.wallet);
      expect(second.engine.players[0].data.credits).to.equal(first.engine.players[0].data.credits);
      expect(second.engine.players[0].data.credits).to.be.at.least(30);
    });

    it("never re-grants onto an origin that already carries the wallet", () => {
      const origin = new Engine(SETUP_MOVES); // already at RoundMove
      applySoloRoundFlow(origin, 0);
      const wallet = grantSandboxWallet(origin, 0);
      const creditsAtEntry = origin.players[0].data.credits;

      const { engine, walletGrantedAt } = replayAnalysisLine(
        origin,
        [{ kind: "move", move: "terrans up nav." }],
        0,
        1,
        wallet
      );

      expect(walletGrantedAt).to.equal(0);
      expect(engine.players[0].data.credits).to.equal(creditsAtEntry);
    });

    it("reports the snapshot the grant landed on, so pre-wallet setup snapshots are not judged against it", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      // Two entries, the wallet arriving on the second: an opponent's booster, then this seat's own.
      const origin2 = new Engine(PARTIAL_SETUP_MOVES.slice(0, -1));
      applySoloRoundFlow(origin2, 0);
      const entries: AnalysisEntry[] = [
        { kind: "move", move: "nevlas booster booster7" },
        { kind: "move", move: "terrans booster booster3" },
      ];

      const { snapshots, wallet, walletGrantedAt } = replayAnalysisLine(origin2, entries, 0, 1, null);

      expect(snapshots).to.have.length(2);
      expect(walletGrantedAt).to.equal(1); // the second entry's snapshot is the first with the grant

      // Scanning from 0 would call the pre-grant snapshot overdrawn; scanning from the grant does not.
      expect(computeAnalysisCounter(snapshots[1], wallet, snapshots, walletGrantedAt).feasible).to.equal(true);
      expect(computeAnalysisCounter(snapshots[1], wallet, snapshots).infeasibleFromMove).to.equal(1);
    });
  });

  describe("adjust entries - the leech adjustment stepper (§4.4, decision #12)", () => {
    it("applies a leech adjustment as a direct power gain, not a move", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const wallet = grantSandboxWallet(origin, 0); // area1/2/3 all >= 4 after the grant
      const before = { ...origin.players[0].data.power };
      const entries: AnalysisEntry[] = [{ kind: "adjust", charge: 2 }];

      const { engine, applied, snapshots } = replayAnalysisLine(origin, entries, 0, 1, wallet);

      expect(applied).to.equal(1);
      expect(snapshots).to.have.length(1);
      // chargePower moves tokens up a level - the receiving areas grow by the charge regardless of
      // which levels exactly moved, and moveHistory gains nothing since no `.move()` ever ran.
      const after = engine.players[0].data.power;
      expect(after.area2 + after.area3).to.equal(before.area2 + before.area3 + 2);
      expect(engine.moveHistory).to.deep.equal(origin.moveHistory);
    });

    it("stops the line at a non-positive adjust entry, exactly like an illegal move", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const wallet = grantSandboxWallet(origin, 0);
      const entries: AnalysisEntry[] = [
        { kind: "adjust", charge: 0 },
        { kind: "move", move: "terrans up nav." },
      ];

      const { applied } = replayAnalysisLine(origin, entries, 0, 1, wallet);

      expect(applied).to.equal(0);
    });

    it("mixes move and adjust entries in one line", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const wallet = grantSandboxWallet(origin, 0);
      const entries: AnalysisEntry[] = [
        { kind: "move", move: "terrans up nav." },
        { kind: "adjust", charge: 3 },
      ];

      const { applied, snapshots } = replayAnalysisLine(origin, entries, 0, 1, wallet);

      expect(applied).to.equal(2);
      expect(snapshots).to.have.length(2);
    });
  });
});

describe("moveBelongsToSeat", () => {
  it("matches a move by its faction name", () => {
    const engine = new Engine(SETUP_MOVES);
    expect(moveBelongsToSeat(engine, "terrans up nav.", 0)).to.equal(true);
    expect(moveBelongsToSeat(engine, "terrans up nav.", 1)).to.equal(false);
  });

  it("matches a move by its p<N> prefix, for before factions are even assigned", () => {
    const engine = new Engine(["init 2 randomSeed"]);
    expect(moveBelongsToSeat(engine, "p1 faction terrans", 0)).to.equal(true);
    expect(moveBelongsToSeat(engine, "p2 faction nevlas", 0)).to.equal(false);
    expect(moveBelongsToSeat(engine, "p2 faction nevlas", 1)).to.equal(true);
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

  it("clearAnalysisLine removes a stored line outright, not just empties it", () => {
    saveAnalysisLine(0, { entries: [{ kind: "move", move: "terrans up nav." }], baseRound: 1, baseMoveCount: 9 });
    clearAnalysisLine(0);
    expect(loadAnalysisLine(0)).to.equal(null);
  });
});

describe("committableAnalysisMoves (§6, decision #13)", () => {
  it("commits the full move-only line when every move stays affordable without the sandbox grant", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans up nav." }];

    const moves = committableAnalysisMoves(origin, entries, 0, 1);

    expect(moves).to.deep.equal(["terrans up nav."]);
  });

  it("excludes adjust entries from the committable result entirely, never counting them as a move", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "adjust", charge: 2 },
    ];

    const moves = committableAnalysisMoves(origin, entries, 0, 1);

    expect(moves).to.deep.equal(["terrans up nav."]);
  });

  it("does not commit a move that only worked because of the real baseline covering it - the seat's true starting resources, not the sandbox grant, decide committability", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    origin.player(0).data.credits = 0;
    origin.player(0).data.ores = 0; // nothing real to spend - only the sandbox grant can pay for this
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans build ts -1x2." }];

    const moves = committableAnalysisMoves(origin, entries, 0, 1);

    expect(moves).to.deep.equal([]);
  });

  it("commits every setup-phase move as-is, since setup carries no cost (no wallet is ever granted)", () => {
    const origin = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans build m -1x2" }];

    const moves = committableAnalysisMoves(origin, entries, 0, 1);

    expect(moves).to.deep.equal(["terrans build m -1x2"]);
  });

  it("returns nothing for a line with no move entries at all", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);

    expect(committableAnalysisMoves(origin, [], 0, 1)).to.deep.equal([]);
    expect(committableAnalysisMoves(origin, [{ kind: "adjust", charge: 1 }], 0, 1)).to.deep.equal([]);
  });

  it("caps at 1 live move plus PremoveBar.vue's 3-row queue limit (§6)", () => {
    expect(MAX_COMMITTABLE_MOVES).to.equal(4);
  });

  it("truncates at an opponent's move, which setup pass-and-play puts in the line as an ordinary entry", () => {
    const origin = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans build m -1x2" },
      { kind: "move", move: "nevlas build m -1x0" }, // decision #7 - placed by me, for them
      { kind: "move", move: "nevlas build m 0x-4" },
    ];

    const moves = committableAnalysisMoves(origin, entries, 0, 1);

    expect(moves).to.deep.equal(["terrans build m -1x2"]);
  });

  it("commits nothing at all from a line built on a faction seed - it describes a table that does not exist", () => {
    const origin = new Engine(["init 2 randomSeed"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] },
      { kind: "move", move: "terrans build m -1x2" },
    ];

    expect(committableAnalysisMoves(origin, entries, 0, 1)).to.deep.equal([]);
  });
});

describe("the round-0 faction seed (§11)", () => {
  const freshGame = () => new Engine(["init 2 randomSeed"]);

  // A Preference Split game whose picks are in but whose bids are not: every faction is claimed,
  // and the auction has yet to decide who keeps which. The case the seed exists for.
  const biddingGame = () =>
    new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"], {
      auction: AuctionVariant.PreferenceSplit,
    });

  describe("factionSeedAvailable", () => {
    it("is available through round 0's faction selection", () => {
      expect(factionSeedAvailable(freshGame())).to.equal(true);
      expect(factionSeedAvailable(biddingGame())).to.equal(true);
    });

    it("is gone once the table is settled and mines are going down", () => {
      const engine = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
      expect(engine.phase).to.equal(Phase.SetupBuilding);
      expect(factionSeedAvailable(engine)).to.equal(false);
      expect(factionSeedAvailable(new Engine(SETUP_MOVES))).to.equal(false);
    });
  });

  describe("analysisFactionPool", () => {
    it("offers what is still on the table mid-pick", () => {
      const pool = analysisFactionPool(freshGame(), 0);
      expect(pool).to.include(Faction.Terrans);
      expect(pool).to.include(Faction.Itars);
      expect(pool.length).to.be.greaterThan(2);
    });

    it("offers the factions the seats already hold once an auction has claimed them all", () => {
      expect(analysisFactionPool(biddingGame(), 0)).to.deep.equal([Faction.Terrans, Faction.Nevlas]);
    });
  });

  describe("buildAnalysisLineup", () => {
    it("seats the chosen faction and fills the rest from what is available", () => {
      const lineup = buildAnalysisLineup(freshGame(), 0, Faction.Itars);
      expect(lineup[0]).to.equal(Faction.Itars);
      expect(lineup).to.have.length(2);
      expect(lineup[1]).to.not.equal(Faction.Itars);
    });

    it("fills the seat AFTER mine too, when the analysis seat is not seat 0", () => {
      const lineup = buildAnalysisLineup(freshGame(), 1, Faction.Itars);
      expect(lineup[1]).to.equal(Faction.Itars);
      expect(lineup[0]).to.not.equal(Faction.Itars);
    });

    it("swaps the two seats when taking a faction an opponent already holds, rather than pulling in a stranger", () => {
      expect(buildAnalysisLineup(biddingGame(), 0, Faction.Nevlas)).to.deep.equal([Faction.Nevlas, Faction.Terrans]);
    });

    it("leaves the table alone when choosing the faction this seat already holds", () => {
      expect(buildAnalysisLineup(biddingGame(), 0, Faction.Terrans)).to.deep.equal([Faction.Terrans, Faction.Nevlas]);
    });
  });

  describe("applyFactionSeed", () => {
    it("assigns the lineup and hands over to setup building, ready for the first starting mine", () => {
      const engine = freshGame();
      applyFactionSeed(engine, [Faction.Itars, Faction.Terrans]);

      expect(engine.phase).to.equal(Phase.SetupBuilding);
      expect(engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
      expect(engine.players[0].board).to.not.equal(null); // faction board actually loaded
    });

    it("keeps engine.setup consistent, so every later turn order still resolves to real seats", () => {
      const engine = freshGame();
      applyFactionSeed(engine, [Faction.Itars, Faction.Terrans]);

      expect(engine.setup).to.have.length(2);
      expect(engine.turnOrderAfterSetupAuction).to.not.include(-1);
    });

    it("preserves the table's own order when it only permutes an already-complete auction pool", () => {
      const engine = biddingGame();
      const before = [...engine.setup];
      applyFactionSeed(engine, [Faction.Nevlas, Faction.Terrans]);

      expect(engine.setup).to.deep.equal(before);
      expect(engine.turnOrderAfterSetupAuction).to.not.include(-1);
      expect(engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Nevlas, Faction.Terrans]);
    });

    it("clears the bid recorded against the faction a seat used to hold", () => {
      const engine = biddingGame();
      engine.players[0].data.bid = 7;
      applyFactionSeed(engine, [Faction.Nevlas, Faction.Terrans]);

      expect(engine.players[0].data.bid).to.equal(0);
    });

    it("refuses to apply once the table is settled", () => {
      const engine = new Engine(SETUP_MOVES);
      expect(() => applyFactionSeed(engine, [Faction.Itars, Faction.Terrans])).to.throw();
    });

    it("refuses a lineup that does not seat every player exactly once", () => {
      expect(() => applyFactionSeed(freshGame(), [Faction.Itars])).to.throw();
      expect(() => applyFactionSeed(freshGame(), [Faction.Itars, Faction.Itars])).to.throw();
    });
  });

  it("runs the whole round-0 flow: seed a faction, place everyone's mines, then round 1 solo", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0); // what enterAnalysisMode does for a round-0 entry
    const entries: AnalysisEntry[] = [
      { kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] },
      // Setup pass-and-play (§2.6/decision #7) - every seat's mines and booster, placed by me.
      { kind: "move", move: "terrans build m -1x2" },
      { kind: "move", move: "nevlas build m -1x0" },
      { kind: "move", move: "nevlas build m 0x-4" },
      { kind: "move", move: "terrans build m -4x-1" },
      { kind: "move", move: "nevlas booster booster7" },
      { kind: "move", move: "terrans booster booster3" },
    ];

    const { engine, applied, wallet } = replayAnalysisLine(origin, entries, 0, Round.Round1, null);

    expect(applied).to.equal(entries.length);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.round).to.equal(Round.Round1);
    expect(engine.turnOrder).to.deep.equal([0]); // solo from here (§2.5)
    expect(engine.playerToMove).to.equal(0);
    expect(wallet).to.not.equal(null); // the sandbox wallet's lazy grant fired at the round-1 handover
  });

  it("does the same from an auction game's bid phase, taking the faction the auction had not yet awarded", () => {
    const origin = biddingGame();
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Nevlas, Faction.Terrans] }];

    const { engine, applied } = replayAnalysisLine(origin, entries, 0, Round.Round1, null);

    expect(applied).to.equal(1);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(engine.players[0].faction).to.equal(Faction.Nevlas);
  });

  it("replays to the same table every time, since the lineup travels with the entry", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Itars, Faction.Terrans] }];

    const first = replayAnalysisLine(origin, entries, 0, Round.Round1, null);
    const second = replayAnalysisLine(origin, entries, 0, Round.Round1, null);

    expect(first.engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
    expect(second.engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
  });

  it("leaves the origin untouched, like every other entry kind", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0);
    const before = JSON.stringify(origin);

    replayAnalysisLine(origin, [{ kind: "faction", lineup: [Faction.Itars, Faction.Terrans] }], 0, Round.Round1, null);

    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("stops the line at a seed that can no longer apply, exactly like an illegal move", () => {
    const origin = new Engine(SETUP_MOVES); // already past faction selection
    const entries: AnalysisEntry[] = [
      { kind: "faction", lineup: [Faction.Itars, Faction.Terrans] },
      { kind: "move", move: "terrans up nav." },
    ];

    const { applied } = replayAnalysisLine(origin, entries, 0, Round.Round1, null);

    expect(applied).to.equal(0);
  });
});
