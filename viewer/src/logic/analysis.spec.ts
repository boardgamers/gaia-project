import Engine, { AuctionVariant, Command, Faction, Phase, Round } from "@gaia-project/engine";
import { expect } from "chai";
import {
  advancePastOwnPass,
  AnalysisEntry,
  analysisCommitPrefix,
  analysisFactionPool,
  applyFactionSeed,
  applySoloRoundFlow,
  buildAnalysisLineup,
  chargedPowerTotal,
  clearAnalysisLine,
  committableAnalysisMoves,
  computeAnalysisStatus,
  factionSeedAvailable,
  isCheapAnalysisBuild,
  loadAnalysisLine,
  MAX_COMMITTABLE_MOVES,
  markAnalysisSeat,
  moveBelongsToSeat,
  planAnalysisCommit,
  replayAnalysisLine,
  resolveOpponentDecisions,
  saveAnalysisLine,
  settleAnalysisClone,
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
    const { engine, applied } = replayAnalysisLine(origin, entries, 0, 1);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("accumulates the assumed power top-up across the whole line, not just its last entry", () => {
    // Every replay step round-trips the engine through JSON, and `analysisAssumedPower` is
    // deliberately not serialized - so without being carried by hand the tally silently restarted on
    // each entry and the header could only ever report what the final move happened to top up.
    const origin = markAnalysisSeat(new Engine(SETUP_MOVES), 0);
    applySoloRoundFlow(origin, 0);
    const first = replayAnalysisLine(origin, [{ kind: "move", move: "terrans action power3." }], 0, 1);
    const both = replayAnalysisLine(
      origin,
      [
        { kind: "move", move: "terrans action power3." },
        { kind: "move", move: "terrans action power4." },
      ],
      0,
      1
    );
    const afterOne = first.engine.players[0].data.analysisAssumedPower;
    expect(afterOne).to.be.greaterThan(0);
    expect(both.applied).to.equal(2);
    expect(both.engine.players[0].data.analysisAssumedPower).to.be.greaterThan(afterOne);
  });

  it("stops at the first entry that has gone illegal, keeping the valid prefix", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans build m 99x99." },
      { kind: "move", move: "nevlas up nav." },
    ];
    const { engine, applied } = replayAnalysisLine(origin, entries, 0, 1);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("leaves the original engine untouched", () => {
    const origin = new Engine(SETUP_MOVES);
    const before = JSON.stringify(origin);
    replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0, 1);
    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("returns the origin itself, unmodified, for an empty line", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine, applied } = replayAnalysisLine(origin, [], 0, 1);
    expect(applied).to.equal(0);
    expect(engine.moveHistory).to.deep.equal(origin.moveHistory);
  });

  it("marks the seat's player data as the sandbox seat on the replayed engine", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0, 1);
    expect(engine.players[0].data.analysis).to.equal(true);
  });

  describe("real resources, no injected wallet (§12)", () => {
    it("leaves a setup-phase line's resources exactly as the engine produced them", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans booster booster3" }]; // last setup move

      const { engine } = replayAnalysisLine(origin, entries, 0, 1);

      expect(engine.phase).to.equal(Phase.RoundMove);
      expect(engine.round).to.equal(1);
      // Round 1 income only - nothing topped it up to a sandbox figure, which is the whole point:
      // the player board shows what this seat really holds.
      const plain = new Engine([...PARTIAL_SETUP_MOVES, "terrans booster booster3"]);
      expect(engine.players[0].data.credits).to.equal(plain.players[0].data.credits);
      expect(engine.players[0].data.ores).to.equal(plain.players[0].data.ores);
    });

    it("replays to the same resources every time, however often the line is re-walked", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans booster booster3" }];

      const first = replayAnalysisLine(origin, entries, 0, 1);
      const second = replayAnalysisLine(origin, entries, 0, 1);

      expect(second.engine.players[0].data.credits).to.equal(first.engine.players[0].data.credits);
    });

    it("lets the seat overspend into debt rather than refusing the move", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      origin.player(0).data.credits = 0;
      origin.player(0).data.ores = 0; // cannot afford a trading station at all

      const { engine, applied } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0, 1);

      expect(applied).to.equal(1); // the move was offered and played anyway (§12)
      const data = engine.players[0].data;
      expect(data.credits + data.ores).to.be.lessThan(0); // ...and the debt is real and visible
    });

    it("never drives a power bowl negative - a power cost beyond the seat's is topped up and counted", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const data = origin.player(0).data;
      data.power.area1 = 0;
      data.power.area2 = 0;
      data.power.area3 = 0;
      data.analysis = true;

      data.spendPower(4);

      expect(data.power.area1).to.be.at.least(0);
      expect(data.power.area2).to.be.at.least(0);
      expect(data.power.area3).to.be.at.least(0);
      expect(data.analysisAssumedPower).to.be.at.least(4);
    });
  });

  describe("adjust entries - the leech adjustment stepper (§4.4, decision #12)", () => {
    it("applies a leech adjustment as a direct power gain, not a move", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const before = { ...origin.players[0].data.power };
      const entries: AnalysisEntry[] = [{ kind: "adjust", charge: 2 }];

      const { engine, applied } = replayAnalysisLine(origin, entries, 0, 1);

      expect(applied).to.equal(1);
      // chargePower moves tokens up a level - the receiving areas grow by the charge regardless of
      // which levels exactly moved, and moveHistory gains nothing since no `.move()` ever ran.
      const after = engine.players[0].data.power;
      expect(after.area2 + after.area3).to.equal(before.area2 + before.area3 + 2);
      expect(engine.moveHistory).to.deep.equal(origin.moveHistory);
    });

    it("stops the line at a non-positive adjust entry, exactly like an illegal move", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [
        { kind: "adjust", charge: 0 },
        { kind: "move", move: "terrans up nav." },
      ];

      const { applied } = replayAnalysisLine(origin, entries, 0, 1);

      expect(applied).to.equal(0);
    });

    it("mixes move and adjust entries in one line", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [
        { kind: "move", move: "terrans up nav." },
        { kind: "adjust", charge: 3 },
      ];

      const { applied } = replayAnalysisLine(origin, entries, 0, 1);

      expect(applied).to.equal(2);
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

  it("declines rather than accepting, so the outcome never depends on the opponent's own settings", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    const powerBefore = { ...origin.player(1).data.power };
    origin.move("terrans build ts -1x2.");
    origin.generateAvailableCommandsIfNeeded();

    resolveOpponentDecisions(origin, 0);

    // A charge would have moved the opponent's tokens up; a decline leaves them exactly where they were.
    expect(origin.player(1).data.power).to.deep.equal(powerBefore);
  });

  it("gets control back through a whole replayed line, so a leech never leaves the player stuck (§12)", () => {
    // The reported bug: building within leech range paused the engine on the opponent's accept/decline
    // prompt, and because analysis mode forces canPlay true, that prompt was rendered instead of the
    // player's own commands - with no way to carry on. Whatever else changes, a replayed line has to
    // come back to the analysis seat's own turn.
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);

    const { engine, applied } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0, 1);

    expect(applied).to.equal(1);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.playerToMove).to.equal(0);
    // ...and with commands to show for it. Declining nulls the list (Engine.executeMove does that
    // after every move) and Commands.vue reads it straight off the store, so a null list here is a
    // board with nothing on it but the Back button - the second half of the same reported bug.
    expect(engine.availableCommands?.length ?? 0).to.be.greaterThan(0);
  });

  it("never throws, whatever state it is handed - a throw here would kill the click mid-line", () => {
    // resolveOpponentDecisions runs outside replayAnalysisLine's own try/catch (it fixes the state up
    // after a move rather than being one), so an exception escaping it freezes the board.
    const engine = new Engine(SETUP_MOVES);
    applySoloRoundFlow(engine, 0);
    engine.move("terrans build ts -1x2.");
    engine.generateAvailableCommandsIfNeeded();
    // A wrecked available-command list: whatever it tries here, it must not propagate.
    engine.availableCommands = [{ name: Command.Decline, player: 1, data: { offers: [] } } as any];

    expect(() => resolveOpponentDecisions(engine, 0)).to.not.throw();
  });
});

describe("opponents' own setup turns (owner instruction, 2026-08-19)", () => {
  it("places an opponent's starting mines for them, so only this seat is ever asked", () => {
    // Decision #7 used to read "pass-and-play: you place EVERY seat's starting mines". The owner's
    // instruction is the opposite - "no mine placement for other factions" - and the engine will not
    // advance to round 1 until every seat has placed, so the sandbox has to place them itself.
    const engine = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    markAnalysisSeat(engine, 0);

    // Seat 0 places first here, so take that turn and hand control back to the opponents.
    const first = engine.findAvailableCommand(0, Command.Build).data.buildings[0];
    engine.move(`terrans build ${first.building} ${first.coordinates}`);
    engine.generateAvailableCommandsIfNeeded();
    expect(engine.playerToMove, "the opponent is up next").to.equal(1);

    resolveOpponentDecisions(engine, 0);

    expect(engine.playerToMove, "control comes back without asking me to place for them").to.equal(0);
    expect(engine.player(1).data.occupied.length, "their mines went down").to.be.greaterThan(0);
  });

  it("is what `autoMove` cannot do - the engine has no auto-play for a setup placement", () => {
    // The reason this needs its own branch rather than falling through to resolveOpponentDecisions'
    // existing `autoMove()` step, which is what handles brainstones and income choices.
    const engine = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    expect(engine.autoMove()).to.equal(false);
  });
});

describe("advancePastOwnPass", () => {
  const passedGame = () => new Engine([...SETUP_MOVES, "terrans pass booster4"]);

  it("rolls a seat that has already passed into the next round instead of re-opening this one", () => {
    const engine = passedGame();
    expect(engine.round).to.equal(Round.Round1);
    expect(engine.passedPlayers).to.deep.equal([0]);
    markAnalysisSeat(engine, 0);

    expect(advancePastOwnPass(engine, 0)).to.equal(true);

    expect(engine.round).to.equal(Round.Round2);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.playerToMove).to.equal(0);
  });

  it("does not let the opponents it passed keep a booster", () => {
    // Same reasoning as the round-0 booster hand-back: in a sandbox where opponents never take a
    // turn, the pool must show every tile free except the one this seat itself holds.
    const engine = passedGame();
    markAnalysisSeat(engine, 0);

    advancePastOwnPass(engine, 0);

    expect(engine.player(1).data.tiles.booster ?? null).to.equal(null);
  });

  it("does nothing at all when this seat has not passed", () => {
    const engine = new Engine(SETUP_MOVES);
    const before = JSON.stringify(engine);

    expect(advancePastOwnPass(engine, 0)).to.equal(false);
    expect(JSON.stringify(engine)).to.equal(before);
  });

  it("does nothing outside RoundMove", () => {
    const engine = new Engine(PARTIAL_SETUP_MOVES);
    expect(advancePastOwnPass(engine, 0)).to.equal(false);
  });
});

describe("settleAnalysisClone", () => {
  it("hands back a playable board when the game is parked on an opponent's leech answer", () => {
    // The state a live async game spends most of its time in. Entering the sandbox there used to
    // leave the clone on the opponent's accept/decline prompt: no commands for this seat, canPlay
    // false, nothing to press. `applySoloRoundFlow` alone cannot fix it (it only acts in RoundMove)
    // and `resolveOpponentDecisions` alone cannot either (it lands in RoundMove with the OPPONENT on
    // turn) - it takes both, in that order, with the solo flow applied again afterwards.
    const engine = new Engine(SETUP_MOVES);
    engine.player(0).data.credits = 20;
    engine.player(0).data.ores = 20;
    engine.move("terrans build ts -1x2.");
    engine.generateAvailableCommandsIfNeeded();
    expect(engine.phase).to.equal(Phase.RoundLeech);
    expect(engine.playerToMove).to.equal(1);
    markAnalysisSeat(engine, 0);

    settleAnalysisClone(engine, 0);

    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.playerToMove).to.equal(0);
    expect(engine.turnOrder).to.deep.equal([0]);
    expect(engine.availableCommands?.filter((c) => c.player === 0).length ?? 0).to.be.greaterThan(0);
  });

  it("leaves an ordinary off-turn entry alone rather than auto-playing the opponent's turn", () => {
    // The reason the solo flow has to run FIRST: it makes it this seat's turn immediately, so
    // `resolveOpponentDecisions` finds nothing to resolve and never reaches its `autoMove()` step -
    // which would otherwise have an opponent take a real turn inside the sandbox.
    const engine = new Engine(SETUP_MOVES);
    markAnalysisSeat(engine, 1);
    const opponentHistory = engine.moveHistory.length;

    settleAnalysisClone(engine, 1);

    expect(engine.playerToMove).to.equal(1);
    expect(engine.moveHistory.length, "no opponent move was played").to.equal(opponentHistory);
  });
});

describe("markAnalysisSeat", () => {
  it("sets the analysis flag on the given seat's player data", () => {
    const engine = new Engine(SETUP_MOVES);
    markAnalysisSeat(engine, 0);
    expect(engine.players[0].data.analysis).to.equal(true);
    expect(engine.players[1].data.analysis).to.equal(false);
  });

  it("carries an assumed-power total onto the clone, since toJSON() drops it", () => {
    const engine = new Engine(SETUP_MOVES);
    engine.players[0].data.analysisAssumedPower = 6;
    const clone = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(engine))), 0, 6);
    expect(clone.players[0].data.analysisAssumedPower).to.equal(6);
    // Without being handed the total, a clone restarts at 0 - which is the whole reason it has to be
    // threaded through by hand rather than left to the serialize/deserialize round trip.
    expect(
      markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(engine))), 0).players[0].data.analysisAssumedPower
    ).to.equal(0);
  });
});

describe("chargedPowerTotal", () => {
  it("sums the line's own Charge 1 presses and ignores everything else", () => {
    expect(
      chargedPowerTotal([
        { kind: "adjust", charge: 1 },
        { kind: "move", move: "terrans up nav." },
        { kind: "adjust", charge: 2 },
      ])
    ).to.equal(3);
    expect(chargedPowerTotal([{ kind: "move", move: "terrans up nav." }])).to.equal(0);
    expect(chargedPowerTotal([])).to.equal(0);
  });
});

describe("computeAnalysisStatus (§12)", () => {
  const view = (over: Partial<{ credits: number; ores: number; knowledge: number; qics: number }>, power = 0) => ({
    credits: 0,
    ores: 0,
    knowledge: 0,
    qics: 0,
    analysisAssumedPower: power,
    ...over,
  });

  it("reports nothing while the line stays within what the seat really has", () => {
    const status = computeAnalysisStatus(view({ credits: 4, ores: 2 }));
    expect(status.overdrawn).to.deep.equal([]);
    expect(status.assumedPower).to.equal(0);
  });

  it("lists every overdrawn resource, and only those", () => {
    const status = computeAnalysisStatus(view({ credits: -7, ores: 3, knowledge: -1, qics: 0 }));
    expect(status.overdrawn).to.deep.equal([
      { kind: "c", amount: -7 },
      { kind: "k", amount: -1 },
    ]);
  });

  it("passes through the power the sandbox assumed was charged", () => {
    expect(computeAnalysisStatus(view({}, 3)).assumedPower).to.equal(3);
  });

  it("treats a snapshot from before assumed power existed as zero", () => {
    const { analysisAssumedPower, ...legacy } = view({});
    expect(computeAnalysisStatus(legacy).assumedPower).to.equal(0);
  });

  it("reports the charged total it is handed, separately from the topped-up one", () => {
    const status = computeAnalysisStatus(view({}, 8), 3);
    expect(status.assumedPower).to.equal(8);
    expect(status.chargedPower).to.equal(3);
    expect(computeAnalysisStatus(view({}, 8)).chargedPower).to.equal(0);
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

  it("commits nothing from a line holding a sandbox cheap Trading Station - it priced a neighbour that is not there", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans build ts 4A4 cheap." },
    ];

    expect(committableAnalysisMoves(origin, entries, 0, Round.Round1)).to.deep.equal([]);
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

describe("analysisCommitPrefix - the cut reason behind the prefix", () => {
  it("reports no cut for a line that is committable end to end", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);

    const { moves, cut } = analysisCommitPrefix(origin, [{ kind: "move", move: "terrans up nav." }], 0, 1);

    expect(moves).to.deep.equal(["terrans up nav."]);
    expect(cut).to.equal(null);
  });

  it("names the overdraft when a move spends past the seat's real resources", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    origin.player(0).data.credits = 0;
    origin.player(0).data.ores = 0;

    const { moves, cut } = analysisCommitPrefix(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0, 1);

    expect(moves).to.deep.equal([]);
    expect(cut).to.equal("overdrawn");
  });

  it("names the faction seed and the cheap build, both of which void the whole line", () => {
    const seeded = new Engine(["init 2 randomSeed"]);
    applySoloRoundFlow(seeded, 0);
    expect(
      analysisCommitPrefix(seeded, [{ kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] }], 0, 1).cut
    ).to.equal("faction");

    const cheap = new Engine(SETUP_MOVES);
    expect(
      analysisCommitPrefix(cheap, [{ kind: "move", move: "terrans build ts 4A4 cheap." }], 0, Round.Round1).cut
    ).to.equal("cheap-build");
  });

  it("names the foreign move that setup pass-and-play left in the line", () => {
    const origin = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans build m -1x2" },
      { kind: "move", move: "nevlas build m -1x0" },
    ];

    const { moves, cut } = analysisCommitPrefix(origin, entries, 0, 1);

    expect(moves).to.deep.equal(["terrans build m -1x2"]);
    expect(cut).to.equal("foreign");
  });
});

describe("planAnalysisCommit - what the Commit confirmation shows (§6)", () => {
  const line = ["a", "b", "c", "d", "e"];

  it("plays move 1 live and queues the rest as premoves when the real game is waiting on this seat", () => {
    const plan = planAnalysisCommit({
      committable: ["a", "b", "c"],
      cut: "overdrawn",
      lineMoves: line,
      onTurn: true,
      hosted: true,
      queueRoom: 3,
    });

    expect(plan.live).to.equal("a");
    expect(plan.queued).to.deep.equal(["b", "c"]);
    expect(plan.dropped).to.deep.equal(["d", "e"]);
    expect(plan.limit).to.equal("line");
    expect(plan.cut).to.equal("overdrawn");
  });

  it("queues everything and plays nothing live off turn - there is no turn for a live move to go into", () => {
    const plan = planAnalysisCommit({
      committable: ["a", "b"],
      cut: null,
      lineMoves: ["a", "b"],
      onTurn: false,
      hosted: true,
      queueRoom: 3,
    });

    expect(plan.live).to.equal(null);
    expect(plan.queued).to.deep.equal(["a", "b"]);
    expect(plan.dropped).to.deep.equal([]);
  });

  it("reports the premove queue, not the line, as the limit when the queue is the shorter of the two", () => {
    const plan = planAnalysisCommit({
      committable: ["a", "b", "c", "d"],
      cut: "cap",
      lineMoves: line,
      onTurn: true,
      hosted: true,
      queueRoom: 1, // two rows already queued for this seat
    });

    expect(plan.live).to.equal("a");
    expect(plan.queued).to.deep.equal(["b"]);
    expect(plan.dropped).to.deep.equal(["c", "d", "e"]);
    expect(plan.limit).to.equal("queue");
    // The line's own cut is no longer the reason anything was left behind, so it is not reported as one.
    expect(plan.cut).to.equal(null);
  });

  it("commits move 1 only in self-contained play, which has no premove queue at all", () => {
    const plan = planAnalysisCommit({
      committable: ["a", "b", "c"],
      cut: null,
      lineMoves: ["a", "b", "c"],
      onTurn: true,
      hosted: false,
      queueRoom: 3,
    });

    expect(plan.live).to.equal("a");
    expect(plan.queued).to.deep.equal([]);
    expect(plan.dropped).to.deep.equal(["b", "c"]);
    expect(plan.limit).to.equal("no-premoves");
  });

  it("commits nothing off turn in self-contained play", () => {
    const plan = planAnalysisCommit({
      committable: ["a"],
      cut: null,
      lineMoves: ["a"],
      onTurn: false,
      hosted: false,
      queueRoom: 3,
    });

    expect(plan.live).to.equal(null);
    expect(plan.queued).to.deep.equal([]);
    expect(plan.dropped).to.deep.equal(["a"]);
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
    it("offers the whole unbanned pool during the BAN round, where nothing is claimed or on offer yet", () => {
      // The one phase FACTION_SEED_PHASES whitelists where the picker used to render nothing at all:
      // no seat holds a faction, and `ChooseFaction` is not among the available commands, so reading
      // only that command produced an empty pool and the seed silently did not exist. Owner
      // instruction, 2026-08-19: in the ban and pick rounds you should just pick the faction you want
      // to try, not walk both phases.
      const engine = new Engine(["init 3 lf-ban"], { auction: AuctionVariant.Silent });
      expect(engine.phase).to.equal(Phase.SetupFactionBan);

      expect(analysisFactionPool(engine, 0)).to.have.length(14);
    });

    it("drops a faction that has already been banned", () => {
      const engine = new Engine(["init 3 lf-ban", "p1 banFaction terrans"], { auction: AuctionVariant.Silent });

      const pool = analysisFactionPool(engine, 1);

      expect(pool).to.have.length(13);
      expect(pool).to.not.contain(Faction.Terrans);
    });

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

  it("runs the whole round-0 flow: seed a faction, place only MY mines, then round 1 solo", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0); // what enterAnalysisMode does for a round-0 entry
    // Owner instruction, 2026-08-19: "no mine placement for other factions". The line holds this
    // seat's own placements and nothing else - opponents' starting mines and their booster are both
    // resolved for them by `resolveOpponentDecisions` after every entry.
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] }];

    // Take whatever the engine offers first each time: the opponent's own mines are already down by
    // the time this seat is asked, so a hardcoded hex could be one they were given.
    for (let i = 0; i < 4; i++) {
      const { engine } = replayAnalysisLine(origin, entries, 0, Round.Round1);
      if (engine.phase !== Phase.SetupBuilding) {
        break;
      }
      expect(engine.playerToMove, "only this seat is ever asked to place").to.equal(0);
      const first = engine.findAvailableCommand(0, Command.Build).data.buildings[0];
      entries.push({ kind: "move", move: `terrans build ${first.building} ${first.coordinates}` });
    }

    const mid = replayAnalysisLine(origin, entries, 0, Round.Round1);
    expect(mid.engine.phase).to.equal(Phase.SetupBooster);
    expect(mid.engine.playerToMove).to.equal(0); // nevlas' pick was made for me
    expect(mid.engine.players[1].data.occupied.length, "the opponent's own mines went down too").to.be.greaterThan(0);
    const mine = mid.engine.findAvailableCommand(0, Command.ChooseRoundBooster).data.boosters[0];
    entries.push({ kind: "move", move: `terrans booster ${mine}` });

    const { engine, applied } = replayAnalysisLine(origin, entries, 0, Round.Round1);

    expect(applied).to.equal(entries.length);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.round).to.equal(Round.Round1);
    expect(engine.turnOrder).to.deep.equal([0]); // solo from here (§2.5)
    expect(engine.playerToMove).to.equal(0);
    // The opponent's pick was made for them only to satisfy the engine's turn-order bookkeeping and
    // handed straight back (owner instruction, PROGRESS #181) - they must not actually keep a
    // booster in a sandbox where they never take a turn, so the pool shows every tile except mine.
    expect(engine.players[1].data.tiles.booster ?? null).to.equal(null);
    expect(engine.tiles.boosters[mine]).to.equal(false);
    expect(Object.values(engine.tiles.boosters).filter((available) => available === false)).to.have.length(1);
  });

  it("does the same from an auction game's bid phase, taking the faction the auction had not yet awarded", () => {
    const origin = biddingGame();
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Nevlas, Faction.Terrans] }];

    const { engine, applied } = replayAnalysisLine(origin, entries, 0, Round.Round1);

    expect(applied).to.equal(1);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(engine.players[0].faction).to.equal(Faction.Nevlas);
  });

  it("replays to the same table every time, since the lineup travels with the entry", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Itars, Faction.Terrans] }];

    const first = replayAnalysisLine(origin, entries, 0, Round.Round1);
    const second = replayAnalysisLine(origin, entries, 0, Round.Round1);

    expect(first.engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
    expect(second.engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
  });

  it("leaves the origin untouched, like every other entry kind", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0);
    const before = JSON.stringify(origin);

    replayAnalysisLine(origin, [{ kind: "faction", lineup: [Faction.Itars, Faction.Terrans] }], 0, Round.Round1);

    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("stops the line at a seed that can no longer apply, exactly like an illegal move", () => {
    const origin = new Engine(SETUP_MOVES); // already past faction selection
    const entries: AnalysisEntry[] = [
      { kind: "faction", lineup: [Faction.Itars, Faction.Terrans] },
      { kind: "move", move: "terrans up nav." },
    ];

    const { applied } = replayAnalysisLine(origin, entries, 0, Round.Round1);

    expect(applied).to.equal(0);
  });
});

describe("isCheapAnalysisBuild", () => {
  it("matches the qualifier as the last token of a turn, which is where the viewer appends it", () => {
    expect(isCheapAnalysisBuild("terrans build ts 4A4 cheap.")).to.equal(true);
    expect(isCheapAnalysisBuild("terrans build ts 4A4.")).to.equal(false);
  });

  it("does not match a build move carrying an ordinary log annotation", () => {
    // Build moves already have trailing tokens in recorded history; none of them is the qualifier.
    expect(isCheapAnalysisBuild("itars build gf 6A9 using area1: 6.")).to.equal(false);
  });

  it("finds it in any turn of a multi-command move string", () => {
    expect(isCheapAnalysisBuild("terrans spend 1o for 1c. build ts 4A4 cheap.")).to.equal(true);
  });
});
