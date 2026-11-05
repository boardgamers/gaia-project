import Engine, {
  AuctionVariant,
  Building,
  Command,
  Faction,
  Phase,
  Planet,
  Resource,
  Round,
} from "@gaia-project/engine";
import { expect } from "chai";
import { passedChargeGame } from "../testing/passed-charge";
import type { AnalysisCommitPlan, AnalysisEntry, AnalysisLineSet, MoveCost } from "./analysis";
import {
  advancePastOwnPass,
  analysisCommitPrefix,
  analysisFactionPool,
  analysisLineLabel,
  analysisLineSetSize,
  applyFactionSeed,
  applySoloRoundFlow,
  buildAnalysisLineup,
  chargedPowerTotal,
  clearAnalysisLine,
  committableAnalysisMoves,
  computeAnalysisStatus,
  dropPlayedAnalysisPrefix,
  emptyAnalysisLineSet,
  factionSeedAvailable,
  isCheapAnalysisBuild,
  limitAnalysisCommit,
  loadAnalysisLines,
  markAnalysisSeat,
  MAX_ANALYSIS_LINES,
  moveBelongsToSeat,
  normalizeAnalysisLineSet,
  ownMoveCount,
  planAnalysisCommit,
  replayAnalysisLine,
  resolveOpponentDecisions,
  saveAnalysisLines,
  settleAnalysisClone,
  summarizeAnalysisLine,
} from "./analysis";

// After these moves it's terrans' (seat 0) turn.
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
  it("can plan into the next solo round without drawing future Automa cards", () => {
    const origin = new Engine(["init 1 solo-planning"], { automaFaction: Faction.Taklons, automaSeed: "private-seed" });
    origin.move("p1 faction hadsch-hallas");
    origin.players[0].settings.autoIncome = true;
    while (!origin.round) {
      while (origin.autoMove()) {}
      if (origin.round) break;
      origin.generateAvailableCommands();
      const cmd = origin.availableCommands[0];
      if (cmd.name === Command.Build) {
        const build = cmd.data.buildings[0];
        origin.move(`p1 build ${build.building} ${build.coordinates}`);
      } else origin.move(`p1 booster ${cmd.data.boosters[0]}`);
    }
    const original = JSON.stringify(origin);
    const booster = Object.keys(origin.tiles.boosters).find((b) => origin.tiles.boosters[b]);
    const planning = markAnalysisSeat(Engine.fromData(JSON.parse(original)), 0);
    applySoloRoundFlow(planning, 0);
    const { engine, applied, blockedReason } = replayAnalysisLine(
      planning,
      [{ kind: "move", move: `hadsch-hallas pass ${booster}` }],
      0
    );
    expect(blockedReason).to.equal(undefined);
    expect(applied).to.equal(1);
    expect(engine.round).to.equal(2);
    expect(engine.options.automaSeed).to.equal(undefined);
    expect(engine.automa.deck).to.equal(undefined);
    expect(JSON.stringify(origin)).to.equal(original);
    const passed = markAnalysisSeat(Engine.fromData(JSON.parse(original)), 0);
    passed.move(`hadsch-hallas pass ${booster}`);
    expect(advancePastOwnPass(passed, 0)).to.equal(true);
    expect(passed.round).to.equal(2);
    expect(passed.automa.deck).to.equal(undefined);
  });

  it("reports spending without subtracting the resources earned by the same move", () => {
    const origin = new Engine(SETUP_MOVES);
    const costs: MoveCost[] = [];
    replayAnalysisLine(origin, [{ kind: "move", move: "terrans spend 1q for 1o. up sci." }], 0, costs);
    expect(costs).to.deep.equal([
      [
        { type: Resource.Qic, count: 1 },
        { type: Resource.Ore, count: 1, gain: true },
        { type: Resource.Knowledge, count: 4 },
      ],
    ]);
  });

  it("replays a legal line onto a fresh clone of the origin", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans up nav." }];
    const { engine, applied, blockedReason } = replayAnalysisLine(origin, entries, 0);
    expect(blockedReason).to.equal(undefined);
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("stops when earlier planned actions have spent the remaining power", () => {
    const origin = markAnalysisSeat(new Engine(SETUP_MOVES), 0);
    applySoloRoundFlow(origin, 0);
    Object.assign(origin.players[0].data.power, { area1: 0, area2: 0, area3: 4 });
    const { engine, applied } = replayAnalysisLine(
      origin,
      [
        { kind: "move", move: "terrans action power3." },
        { kind: "move", move: "terrans action power4." },
      ],
      0
    );
    expect(applied).to.equal(1);
    expect(engine.players[0].data.power.area3).to.equal(0);
    expect(engine.players[0].data.analysisAssumedPower).to.equal(0);
  });

  it("stops at the first entry that has gone illegal, keeping the valid prefix", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans build m 99x99." },
      { kind: "move", move: "nevlas up nav." },
    ];
    const { engine, applied, blockedReason } = replayAnalysisLine(origin, entries, 0);
    expect(blockedReason).to.be.a("string").and.not.equal("");
    expect(applied).to.equal(1);
    expect(engine.moveHistory[engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
  });

  it("shows an asteroid's spent Gaiaformer exactly once in simulated costs and the log", () => {
    const origin = new Engine(SETUP_MOVES);
    origin.map.getS("0x2").data.planet = Planet.Asteroid;
    origin.clearAvailableCommands();
    const before = JSON.stringify(origin);
    const costs: MoveCost[] = [];
    const { engine, applied } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans build m 0x2." }], 0, costs);
    expect(applied).to.equal(1);
    expect(costs[0].filter((cost) => cost.type === Resource.GaiaFormer)).to.deep.equal([
      { type: Resource.GaiaFormer, count: 1 },
    ]);
    const entry = engine.advancedLog.find((entry) => entry.changes?.[Command.Build]?.[Resource.GaiaFormer] === -1);
    expect(entry).to.not.equal(undefined);
    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("leaves the original engine untouched", () => {
    const origin = new Engine(SETUP_MOVES);
    const before = JSON.stringify(origin);
    replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0);
    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("returns the origin itself, unmodified, for an empty line", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine, applied } = replayAnalysisLine(origin, [], 0);
    expect(applied).to.equal(0);
    expect(engine.moveHistory).to.deep.equal(origin.moveHistory);
  });

  it("marks the seat's player data as the sandbox seat on the replayed engine", () => {
    const origin = new Engine(SETUP_MOVES);
    const { engine } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans up nav." }], 0);
    expect(engine.players[0].data.analysis).to.equal(true);
  });

  describe("real resources, no injected wallet (§12)", () => {
    it("leaves a setup-phase line's resources exactly as the engine produced them", () => {
      const origin = new Engine(PARTIAL_SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans booster booster3" }]; // last setup move

      const { engine } = replayAnalysisLine(origin, entries, 0);

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

      const first = replayAnalysisLine(origin, entries, 0);
      const second = replayAnalysisLine(origin, entries, 0);

      expect(second.engine.players[0].data.credits).to.equal(first.engine.players[0].data.credits);
    });

    it("rejects an unaffordable build without spending anything", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      origin.player(0).data.credits = 0;
      origin.player(0).data.ores = 0; // cannot afford a trading station at all

      const { engine, applied } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0);

      expect(applied).to.equal(0);
      const data = engine.players[0].data;
      expect(data.credits).to.equal(0);
      expect(data.ores).to.equal(0);
    });

    it("rejects a power action without inventing charges or tokens", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      Object.assign(origin.player(0).data.power, { area1: 0, area2: 0, area3: 0 });
      const { engine, applied } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans action power3." }], 0);
      expect(applied).to.equal(0);
      expect(engine.players[0].data.power).to.deep.equal(origin.players[0].data.power);
      expect(engine.players[0].data.analysisAssumedPower).to.equal(0);
    });
  });

  describe("adjust entries - the leech adjustment stepper (§4.4, decision #12)", () => {
    it("applies a leech adjustment as a direct power gain, not a move", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const before = { ...origin.players[0].data.power };
      const entries: AnalysisEntry[] = [{ kind: "adjust", charge: 2 }];

      const { engine, applied } = replayAnalysisLine(origin, entries, 0);

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

      const { applied } = replayAnalysisLine(origin, entries, 0);

      expect(applied).to.equal(0);
    });

    it("mixes move and adjust entries in one line", () => {
      const origin = new Engine(SETUP_MOVES);
      applySoloRoundFlow(origin, 0);
      const entries: AnalysisEntry[] = [
        { kind: "move", move: "terrans up nav." },
        { kind: "adjust", charge: 3 },
      ];

      const { applied } = replayAnalysisLine(origin, entries, 0);

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

describe("ownMoveCount", () => {
  it("counts own turns without treating leech responses as played sandbox moves", () => {
    const engine = new Engine(SETUP_MOVES);
    const moves = ["terrans build m 2A3.", "nevlas charge 1pw", "terrans up nav."];
    expect(ownMoveCount(engine, moves, 0)).to.equal(2);
    expect(ownMoveCount(engine, moves, 1)).to.equal(0);
    expect(ownMoveCount(engine, [], 0)).to.equal(0);
  });
});

describe("dropPlayedAnalysisPrefix", () => {
  const engine = new Engine(SETUP_MOVES);
  const move = (text: string): AnalysisEntry => ({ kind: "move", move: text });
  const nav = move("terrans up nav.");
  const mine = move("terrans build m 2A3.");

  it("continues after income was resolved in a different order, including the Terrans Gaia conversion", () => {
    const income = move("terrans income 2t. income t");
    const gaia = move("terrans spend 6tg for 6c");
    const result = dropPlayedAnalysisPrefix(engine, [income, gaia], 0, [
      "nevlas income 4pw",
      "terrans income t. income 2t (0/1/0/6 ⇒ 0/1/3/6)",
      "terrans spend 6tg for 6c (0/1/3/6 ⇒ 0/7/3/0)",
    ]);
    expect(result.entries).to.deep.equal([]);
    expect(result.played[0].incomeResolved).to.equal(true);
    expect(result.played[1].incomeResolved).to.equal(undefined);
  });

  it("uses the server's skipped-income receipt when automatic income adds no own log move", () => {
    const live = new Engine(SETUP_MOVES);
    const income = "terrans income 2t. income t";
    const base = live.moveHistory.length;
    const newMoves = ["nevlas pass booster5", "terrans spend 6tg for 6c"];
    live.moveHistory.push(...newMoves);
    live.automation = {
      version: 1,
      increments: [],
      turns: [],
      liveUpdate: false,
      plans: {
        0: {
          revision: 1,
          round: 2,
          moves: [],
          runs: [
            {
              id: "income",
              status: "completed",
              steps: [
                { move: income, timing: { round: 2, phase: Phase.RoundIncome }, status: "skipped", moveIndex: base },
              ],
            },
          ],
        },
      },
    };
    const result = dropPlayedAnalysisPrefix(live, [move(income), move(newMoves[1])], 0, newMoves, base);
    expect(result.entries).to.deep.equal([]);
    expect(result.played[0]).to.deep.equal({
      move: income,
      moveIndex: base,
      incomeResolved: true,
      historyMove: newMoves[0],
    });
    // A future income choice cannot consume the same receipt again.
    expect(dropPlayedAnalysisPrefix(live, [move(income)], 0, [], live.moveHistory.length).entries).to.have.length(1);
  });

  it("does not mistake a multi-command turn containing income for an income-only choice", () => {
    const entry = move("terrans income t. spend 1q for 1o");
    expect(dropPlayedAnalysisPrefix(engine, [entry], 0, ["terrans income t"]).entries).to.deep.equal([entry]);
  });

  it("trims a played research once even though it can still be researched again", () => {
    const result = dropPlayedAnalysisPrefix(engine, [nav, nav, mine], 0, ["terrans up nav (0 ⇒ 1)."]);
    expect(result.dropped).to.equal(1);
    expect(result.entries).to.deep.equal([nav, mine]);
  });

  it("trims multiple turns through opponents and autoleech, including coordinate aliases", () => {
    const coords = engine.map.parse("2A3");
    const result = dropPlayedAnalysisPrefix(engine, [mine, nav, nav], 0, [
      `p1 build m ${coords.q}x${coords.r}.`,
      "nevlas up nav (0 ⇒ 1).",
      "terrans charge 1.",
      "terrans up nav (0 ⇒ 1).",
    ]);
    expect(result.entries).to.deep.equal([nav]);
    expect(result.dropped).to.equal(2);
    expect(result.played.map((entry) => entry.moveIndex)).to.deep.equal([
      engine.moveHistory.length - 4,
      engine.moveHistory.length - 1,
    ]);
  });

  it("does not trim a different move, even when that planned move has become invalid", () => {
    const after = new Engine([...SETUP_MOVES, "terrans build m 2A3."]);
    const result = dropPlayedAnalysisPrefix(after, [mine, nav], 0, ["terrans up nav (0 ⇒ 1)."]);
    expect(result.entries).to.deep.equal([mine, nav]);
    expect(result.dropped).to.equal(0);
  });

  it("removes simulated charges only together with their played turn", () => {
    const charge: AnalysisEntry = { kind: "adjust", charge: 2 };
    expect(dropPlayedAnalysisPrefix(engine, [charge, nav, charge, mine], 0, ["terrans up nav."]).entries).to.deep.equal(
      [charge, mine]
    );
    expect(dropPlayedAnalysisPrefix(engine, [charge, nav], 0, ["terrans charge 2."]).entries).to.deep.equal([
      charge,
      nav,
    ]);
  });

  it("matches a guarded upgrade when the regular control played the same building", () => {
    const ts = move("terrans build ts -1x2 cheap.");
    expect(
      dropPlayedAnalysisPrefix(engine, [ts, nav], 0, ["terrans build ts 3A3. (2/4/0/0 ⇒ 1/5/0/0)"]).entries
    ).to.deep.equal([nav]);
  });

  const federation = "terrans federation 1A4,1A5,1B2,2A1,9A8,9A9 ship-fed-range. build m 8A6.";
  const loggedFederation =
    "terrans federation 1A4,1A5,1B2,2A1,9A8,9A9 ship-fed-range using area2: 1, area3: 1. build m 8A6. (0/1/10/0 ⇒ 0/0/9/0)";

  it("matches the Devious-basket-7886 federation despite its power-payment annotation", () => {
    const charge: AnalysisEntry = { kind: "adjust", charge: 2 };
    const result = dropPlayedAnalysisPrefix(engine, [charge, move(federation), nav], 0, [loggedFederation]);
    expect(result.entries).to.deep.equal([nav]);
    expect(result.dropped).to.equal(1);
    expect(result.played[0].move).to.equal(loggedFederation);
  });

  it("matches federation hex sets regardless of order or coordinate aliases, including sector centres", () => {
    const hexes = ["1A4", "1B2", "1C"];
    const coordinates = hexes.map((hex) => {
      const { q, r } = engine.map.parse(hex);
      return `${q}x${r}`;
    });
    const planned = move(`terrans federation ${hexes.join(",")} fed3.`);
    const result = dropPlayedAnalysisPrefix(engine, [planned, nav], 0, [
      `terrans federation ${coordinates.reverse().join(",")} fed3 using area1: 1.`,
    ]);
    expect(result.entries).to.deep.equal([nav]);
  });

  it("keeps federation alternatives with a different hex, token, follow-up build or conversion", () => {
    for (const alternative of [
      federation.replace("1A4", "1A3"),
      federation.replace("ship-fed-range", "fed3"),
      federation.replace("8A6", "8A7"),
      federation.replace(". build m 8A6.", "."),
      federation.replace("terrans ", "terrans spend 1q for 1o. "),
    ]) {
      const entry = move(alternative);
      expect(dropPlayedAnalysisPrefix(engine, [entry], 0, [loggedFederation]).entries).to.deep.equal([entry]);
    }
    expect(
      dropPlayedAnalysisPrefix(engine, [move(federation)], 0, [loggedFederation.replace("terrans", "nevlas")]).dropped
    ).to.equal(0);
  });

  it("repairs a federation saved past its actual move and consumes subsequent turns only once", () => {
    const live = new Engine(SETUP_MOVES);
    const base = live.moveHistory.length;
    live.moveHistory.push("terrans up eco (0 ⇒ 1).", loggedFederation, "nevlas up nav.", "terrans up nav.");
    const previousPlayed = [{ move: live.moveHistory[base], moveIndex: base }];
    const result = dropPlayedAnalysisPrefix(
      live,
      [move(federation), nav, nav],
      0,
      [],
      live.moveHistory.length,
      previousPlayed
    );
    expect(result.entries).to.deep.equal([nav]);
    expect(result.played).to.deep.equal([
      { move: loggedFederation, moveIndex: base + 1 },
      { move: "terrans up nav.", moveIndex: base + 3 },
    ]);
    const reopened = dropPlayedAnalysisPrefix(live, result.entries, 0, [], live.moveHistory.length, [
      ...previousPlayed,
      ...result.played,
    ]);
    expect(reopened.entries).to.deep.equal([nav]);
    expect(reopened.played).to.deep.equal([]);
  });

  it("recovers across the saved base without consuming a subsequent research twice", () => {
    const live = new Engine(SETUP_MOVES);
    const federationIndex = live.moveHistory.length;
    live.moveHistory.push(loggedFederation, "nevlas up nav.");
    const base = live.moveHistory.length;
    const newMoves = ["terrans up nav.", "nevlas charge 1."];
    live.moveHistory.push(...newMoves);
    const result = dropPlayedAnalysisPrefix(live, [move(federation), nav, nav], 0, newMoves, base);
    expect(result.entries).to.deep.equal([nav]);
    expect(result.played).to.deep.equal([
      { move: loggedFederation, moveIndex: federationIndex },
      { move: newMoves[0], moveIndex: base },
    ]);
  });

  it("preserves a fresh Ivits plan that legally federates the same hexes and token again", () => {
    const live = new Engine(["init 2 randomSeed", "p1 faction ivits", "p2 faction terrans"]);
    live.phase = Phase.RoundMove;
    live.round = 1;
    live.turnOrder = [0];
    live.currentPlayer = 0;
    const player = live.players[0];
    player.data.qics = 10;
    const coords = ["0x0", "1x0", "2x0", "0x1", "1x1", "2x1"];
    const buildings = [
      Building.PlanetaryInstitute,
      Building.Academy1,
      Building.ResearchLab,
      Building.ResearchLab,
      Building.TradingStation,
      Building.TradingStation,
    ];
    coords.forEach((coord, index) => {
      const hex = live.map.getS(coord);
      hex.data.planet = Planet.Terra;
      hex.data.player = 0;
      hex.data.building = buildings[index];
      player.data.occupied.push(hex);
      player.data.buildings[buildings[index]]++;
    });
    live.clearAvailableCommands();
    const entry = move(`ivits federation ${coords.join(",")} fed2.`);
    live.move(entry.move);
    expect(player.data.federationCount).to.equal(1);
    const base = live.moveHistory.length;
    expect(dropPlayedAnalysisPrefix(live, [entry], 0, [], base).entries).to.deep.equal([entry]);
    live.move(entry.move);
    expect(player.data.federationCount).to.equal(2);
    expect(dropPlayedAnalysisPrefix(live, [entry], 0, live.moveHistory.slice(base), base).entries).to.deep.equal([]);
  });

  it("recovers a stale federation even when it was the first planned turn", () => {
    const live = new Engine(SETUP_MOVES);
    live.moveHistory.push(loggedFederation);
    const result = dropPlayedAnalysisPrefix(live, [move(federation), nav], 0, [], live.moveHistory.length);
    expect(result.entries).to.deep.equal([nav]);
    expect(result.played[0]).to.deep.equal({ move: loggedFederation, moveIndex: live.moveHistory.length - 1 });
  });

  it("does not recover an alternative, an already-retired federation or a divergent played history", () => {
    const live = new Engine(SETUP_MOVES);
    const base = live.moveHistory.length;
    live.moveHistory.push(loggedFederation, "terrans up nav.");
    const entry = move(federation);
    const different = move(federation.replace("8A6", "8A7"));
    expect(dropPlayedAnalysisPrefix(live, [different], 0, [], live.moveHistory.length).entries).to.deep.equal([
      different,
    ]);
    for (const previousPlayed of [
      [{ move: loggedFederation, moveIndex: base }],
      [{ move: "terrans up gaia.", moveIndex: base - 1 }],
    ]) {
      expect(
        dropPlayedAnalysisPrefix(live, [entry], 0, [], live.moveHistory.length, previousPlayed).entries
      ).to.deep.equal([entry]);
    }
  });

  it("keeps the whole turn when only one command matches", () => {
    const turn = move("terrans spend 1q for 1o. up nav.");
    expect(dropPlayedAnalysisPrefix(engine, [turn], 0, ["terrans up nav."]).entries).to.deep.equal([turn]);
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

    const { engine, applied } = replayAnalysisLine(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0);

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

describe("opponents' setup turns in planning", () => {
  it("skips remaining placements without moving for opponents or changing their board", () => {
    // Nevlas has placed one real mine and is due to place another before our next turn.
    const engine = new Engine(SETUP_MOVES.slice(0, 5));
    markAnalysisSeat(engine, 0);
    const opponent = JSON.stringify(engine.player(1));
    const history = [...engine.moveHistory];
    settleAnalysisClone(engine, 0);
    expect(engine.playerToMove).to.equal(0);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(JSON.stringify(engine.player(1))).to.equal(opponent);
    expect(engine.moveHistory).to.deep.equal(history);
  });

  it("skips an opponent's booster pick after our own and enters round one without a fictitious pick", () => {
    const engine = new Engine(SETUP_MOVES.slice(0, 7));
    markAnalysisSeat(engine, 1);
    settleAnalysisClone(engine, 1);
    const history = [...engine.moveHistory];
    const { engine: result, applied } = replayAnalysisLine(
      engine,
      [{ kind: "move", move: "nevlas booster booster7" }],
      1
    );
    expect(applied).to.equal(1);
    expect(result.phase).to.equal(Phase.RoundMove);
    expect(result.playerToMove).to.equal(1);
    expect(result.players[0].data.tiles.booster ?? null).to.equal(null);
    expect(result.moveHistory.slice(history.length)).to.deep.equal(["nevlas booster booster7"]);
    expect(result.tiles.boosters.booster3).to.equal(true);
  });

  it("can enter after our setup is finished without replaying our booster or placing more mines", () => {
    const engine = new Engine(SETUP_MOVES.slice(0, 8));
    markAnalysisSeat(engine, 1);
    const history = [...engine.moveHistory];
    const occupied = [...engine.players[1].data.occupied];
    settleAnalysisClone(engine, 1);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.playerToMove).to.equal(1);
    expect(engine.players[1].data.occupied).to.deep.equal(occupied);
    expect(engine.players[1].data.tiles.booster).to.equal("booster7");
    expect(engine.players[0].data.tiles.booster ?? null).to.equal(null);
    expect(engine.moveHistory).to.deep.equal(history);
  });
});

describe("advancePastOwnPass", () => {
  const passedGame = () => new Engine([...SETUP_MOVES, "terrans pass booster4"]);

  for (const accepted of [false, true]) {
    it(`keeps a passed player's next-round income ${accepted ? "after accepting power" : "while power is offered"}`, () => {
      const real = passedChargeGame();
      if (accepted) real.move("firaks charge 1pw");
      expect(real.phase).to.equal(Phase.RoundLeech);
      expect(real.playerToMove).to.equal(accepted ? 0 : 2);
      const original = JSON.stringify(real);
      const engine = markAnalysisSeat(Engine.fromData(JSON.parse(original)), 2);
      const expected = markAnalysisSeat(Engine.fromData(JSON.parse(original)), 2);
      if (!accepted) expected.move("firaks decline 1pw");
      expected.move("terrans decline 1pw");
      expect(advancePastOwnPass(expected, 2)).to.equal(true);
      settleAnalysisClone(expected, 2);

      expect(advancePastOwnPass(engine, 2)).to.equal(true);
      settleAnalysisClone(engine, 2);

      expect(engine.round).to.equal(Round.Round2);
      expect(engine.playerToMove).to.equal(2);
      expect(engine.players[2].data.power).to.deep.equal(expected.players[2].data.power);
      expect(engine.players[2].data.credits).to.equal(expected.players[2].data.credits);
      expect(engine.players[2].data.ores).to.equal(expected.players[2].data.ores);
      expect(engine.players[2].data.knowledge).to.equal(expected.players[2].data.knowledge);
      expect(JSON.stringify(real)).to.equal(original);
    });
  }

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

  it("does nothing during setup", () => {
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

describe("analysis booster reservations", () => {
  function game() {
    return new Engine([
      "init 4 concurrent-charge-test",
      "p1 faction terrans",
      "p2 faction nevlas",
      "p3 faction firaks",
      "p4 faction hadsch-hallas",
      "p1 build m 8A2",
      "p2 build m 8B1",
      "p3 build m 8B3",
      "p4 build m 7B5",
      "p4 build m 1A2",
      "p3 build m 7A4",
      "p2 build m 5A2",
      "p1 build m 4A4",
      "p4 booster booster2",
      "p3 booster booster4",
      "p2 booster booster5",
      "p1 booster booster6",
      "hadsch-hallas income 2t",
      "terrans pass booster9",
      "nevlas pass booster8",
    ]);
  }

  function preview(real: Engine, seat: number) {
    const engine = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(real))), seat);
    advancePastOwnPass(engine, seat);
    settleAnalysisClone(engine, seat);
    return engine;
  }

  function passBoosters(engine: Engine, seat: number) {
    return engine.findAvailableCommand(seat, Command.Pass).data.boosters;
  }

  for (const seat of [2, 3]) {
    it(`keeps already-passed opponents' next boosters out of the pass menu ${seat === 2 ? "on turn" : "off turn"}`, () => {
      const real = game();
      const original = JSON.stringify(real);
      expect(real.playerToMove).to.equal(2);
      expect(real.passedPlayers).to.deep.equal([0, 1]);
      const origin = preview(real, seat);
      const { engine, applied, blockedReason } = replayAnalysisLine(
        origin,
        [{ kind: "move", move: `${real.players[seat].faction} up nav.` }],
        seat
      );
      expect(applied).to.equal(1);
      expect(blockedReason).to.equal(undefined);
      expect(engine.turnOrder).to.deep.equal([seat]);
      expect(engine.round).to.equal(1);
      expect(passBoosters(engine, seat)).to.have.members(
        Object.keys(real.tiles.boosters).filter(
          (booster) => !["booster8", "booster9", real.players[seat].data.tiles.booster].includes(booster)
        )
      );
      // Still assume a not-yet-passed opponent can return their old booster before our pass.
      expect(passBoosters(engine, seat)).to.include(seat === 2 ? "booster2" : "booster4");
      expect(passBoosters(engine, seat)).to.include("booster6"); // actually returned by Terrans
      expect(passBoosters(engine, seat)).to.include("booster5"); // actually returned by Nevlas
      expect(JSON.stringify(real)).to.equal(original);
    });
  }

  it("rejects a reserved selection during replay without mutating the real game, origin or saved line", () => {
    const real = game();
    const origin = preview(real, 2);
    const original = JSON.stringify(real);
    const base = JSON.stringify(origin);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "firaks up nav." },
      { kind: "move", move: "firaks pass booster8" },
    ];
    const saved = JSON.stringify(entries);
    const result = replayAnalysisLine(origin, entries, 2);
    expect(result.applied).to.equal(1);
    expect(result.blockedReason).to.contain("booster8 is not in the available boosters");
    expect(result.engine.round).to.equal(1);
    expect(result.engine.players[2].data.tiles.booster).to.equal("booster4");
    expect(JSON.stringify(real)).to.equal(original);
    expect(JSON.stringify(origin)).to.equal(base);
    expect(JSON.stringify(entries)).to.equal(saved);
  });

  it("expires reservations at the round boundary, keeps solo flow, and returns our old booster", () => {
    const real = game();
    const original = JSON.stringify(real);
    const origin = preview(real, 2);
    const first = replayAnalysisLine(origin, [{ kind: "move", move: "firaks pass booster5" }], 2);
    expect(first.blockedReason).to.equal(undefined);
    expect(first.applied).to.equal(1);
    expect(first.engine.round).to.equal(2);
    expect(first.engine.turnOrder).to.deep.equal([2]);
    expect(first.engine.passedPlayers).to.deep.equal([]);
    expect(first.engine.playerToMove).to.equal(2);
    expect(passBoosters(first.engine, 2)).to.include.members(["booster8", "booster9", "booster4"]);
    expect(passBoosters(first.engine, 2)).to.not.include("booster5");

    // The choice now targets round 3, not the round 2 those real opponents reserved.
    const later = replayAnalysisLine(first.engine, [{ kind: "move", move: "firaks pass booster8" }], 2);
    expect(later.blockedReason).to.equal(undefined);
    expect(later.applied).to.equal(1);
    expect(later.engine.round).to.equal(3);
    expect(later.engine.turnOrder).to.deep.equal([2]);
    expect(passBoosters(later.engine, 2)).to.include.members(["booster5", "booster9"]);
    expect(passBoosters(later.engine, 2)).to.not.include("booster8");
    expect(JSON.stringify(real)).to.equal(original);
  });

  it("does not extend already-passed opponents' reservations after entering with our own seat passed", () => {
    const real = game();
    real.move("firaks pass booster5");
    const original = JSON.stringify(real);
    expect(real.passedPlayers).to.deep.equal([0, 1, 2]);
    const engine = preview(real, 2);
    expect(engine.round).to.equal(2);
    expect(engine.turnOrder).to.deep.equal([2]);
    expect(engine.playerToMove).to.equal(2);
    expect(engine.players[2].data.tiles.booster).to.equal("booster5");
    expect(passBoosters(engine, 2)).to.include.members(["booster8", "booster9", "booster4", "booster2"]);
    expect(passBoosters(engine, 2)).to.not.include("booster5");
    expect(JSON.stringify(real)).to.equal(original);
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

  it("distinguishes spending 4 ore from a remaining balance of minus 2", () => {
    const status = computeAnalysisStatus(view({ ores: -2 }), 0, view({ ores: 2 }));
    expect(status.changes).to.deep.equal([{ kind: "o", amount: -4 }]);
    expect(status.overdrawn).to.deep.equal([{ kind: "o", amount: -2 }]);
    const gain = computeAnalysisStatus(view({ ores: 3 }), 0, view({ ores: 2 }));
    expect(gain.changes).to.deep.equal([{ kind: "o", amount: 1 }]);
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
  const up = { kind: "move", move: "terrans up nav." } as AnalysisEntry;

  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a saved set for the same seat", () => {
    const set = { lines: [[up], []], active: 1, baseMoveCount: 9 };
    saveAnalysisLines(0, set);
    expect(loadAnalysisLines(0)).to.deep.equal(set);
  });

  it("drops obsolete metadata from stored multi-plan drafts while retaining the base move and played history", () => {
    const key = `analysis-mode:${window.location.search}:0`;
    const set: AnalysisLineSet = {
      lines: [[up], []],
      active: 1,
      baseMoveCount: 14,
      baseMove: "nevlas pass booster4",
      played: [
        [
          { move: "terrans pass booster5", moveIndex: 12 },
          { move: "terrans income 2t", moveIndex: 13, incomeResolved: true, historyMove: "nevlas pass booster4" },
        ],
        [],
      ],
    };
    const obsolete = { ...set, baseRound: 2, obsoleteMetadata: "ignored" };
    window.localStorage.setItem(key, JSON.stringify(obsolete));

    const loaded = loadAnalysisLines(0);
    expect(loaded).to.deep.equal(set);
    saveAnalysisLines(0, loaded);
    expect(JSON.parse(window.localStorage.getItem(key))).to.deep.equal(set);

    // Saving an old-shaped object directly must also discard fields that are no longer used.
    saveAnalysisLines(0, obsolete);
    expect(JSON.parse(window.localStorage.getItem(key))).to.deep.equal(set);
  });

  it("preserves whether optional fields were absent or explicitly present during normalization", () => {
    const empty = emptyAnalysisLineSet(9);
    expect(empty).to.deep.equal({ lines: [[]], active: 0, baseMoveCount: 9 });
    for (const set of [
      empty,
      { ...empty, baseMove: "", played: [] },
      { ...empty, baseMove: undefined, played: undefined },
    ]) {
      const normalized = normalizeAnalysisLineSet(set);
      expect(normalized).to.deep.equal(set);
      expect(normalized).to.have.all.keys(Object.keys(set));
    }
  });

  it("keeps different seats' lines separate", () => {
    saveAnalysisLines(0, emptyAnalysisLineSet(9));
    expect(loadAnalysisLines(1)).to.equal(null);
  });

  it("keeps hosted games separate even when their iframe URL and seat match", () => {
    const set = { lines: [[up]], active: 0, baseMoveCount: 9 };
    saveAnalysisLines(0, set, "init 2 first-game");
    expect(loadAnalysisLines(0, "init 2 second-game")).to.equal(null);
    saveAnalysisLines(0, emptyAnalysisLineSet(9), "init 2 second-game");
    clearAnalysisLine(0, "init 2 second-game");
    expect(loadAnalysisLines(0, "init 2 first-game")).to.deep.equal(set);
  });

  it("returns null when nothing is stored", () => {
    expect(loadAnalysisLines(0)).to.equal(null);
  });

  it("clearAnalysisLine removes every stored line outright, not just empties them", () => {
    saveAnalysisLines(0, { lines: [[up], [up]], active: 0, baseMoveCount: 9 });
    clearAnalysisLine(0);
    expect(loadAnalysisLines(0)).to.equal(null);
  });

  // §13's migration. Real in-progress games are carrying a pre-tabs value right now (master deploys
  // to production on push), so a single stored line has to come back as Line 1 rather than as
  // "nothing stored" - losing a line the player can see in the UI is not an acceptable upgrade.
  it("reads a pre-tabs single line back as Line 1 and drops baseRound when saving it", () => {
    const key = `analysis-mode:${window.location.search}:0`;
    window.localStorage.setItem(key, JSON.stringify({ entries: [up], baseRound: 2, baseMoveCount: 14 }));
    const expected = { lines: [[up]], active: 0, baseMoveCount: 14 };
    const loaded = loadAnalysisLines(0);
    expect(loaded).to.deep.equal(expected);
    saveAnalysisLines(0, loaded);
    expect(JSON.parse(window.localStorage.getItem(key))).to.deep.equal(expected);
  });

  it("treats a stored value of neither shape as nothing stored", () => {
    window.localStorage.setItem(`analysis-mode:${window.location.search}:0`, JSON.stringify({ nonsense: true }));
    expect(loadAnalysisLines(0)).to.equal(null);
  });

  it("normalizes a set with no lines or an out-of-range active index", () => {
    expect(normalizeAnalysisLineSet({ lines: [], active: 4, baseMoveCount: 9 })).to.deep.equal({
      lines: [[]],
      active: 0,
      baseMoveCount: 9,
    });
    expect(normalizeAnalysisLineSet({ lines: [[up], []], active: 7, baseMoveCount: 9 }).active).to.equal(1);
  });

  it("caps a set at MAX_ANALYSIS_LINES", () => {
    const lines = Array.from({ length: MAX_ANALYSIS_LINES + 3 }, () => [up]);
    const capped = normalizeAnalysisLineSet({ lines, active: 0, baseMoveCount: 9 });
    expect(capped.lines.length).to.equal(MAX_ANALYSIS_LINES);
  });

  it("counts every move across every line", () => {
    expect(analysisLineSetSize({ lines: [[up, up], [], [up]], active: 0, baseMoveCount: 9 })).to.equal(3);
  });

  it("labels alternative plans alphabetically", () => {
    expect(analysisLineLabel(0)).to.equal("Plan A");
    expect(analysisLineLabel(4)).to.equal("Plan E");
  });
});

// §13's tab strip is only a comparison because each tab carries its own outcome - switching replaces
// the board, so a strip that only switched would still leave the player comparing from memory.
describe("summarizeAnalysisLine (§13)", () => {
  it("does not count simulated charges as game turns", () => {
    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [
      { kind: "adjust", charge: 1 },
      { kind: "move", move: "terrans up nav." },
      { kind: "adjust", charge: 1 },
    ];
    const summary = summarizeAnalysisLine(origin, entries, 0, 0);
    expect(summary.moves).to.equal(1);
    expect(summary.applied).to.equal(1);
  });

  it("reports an empty line as no moves and no change", () => {
    const origin = markAnalysisSeat(new Engine(SETUP_MOVES), 0);
    expect(summarizeAnalysisLine(origin, [], 0, 0)).to.deep.equal({
      label: "Plan A",
      moves: 0,
      victoryPoints: 0,
      overdrawn: false,
      applied: 0,
    });
  });

  it("reports VP as a delta against where the sandbox started", () => {
    const origin = markAnalysisSeat(new Engine(SETUP_MOVES), 0);
    const base = origin.players[0].data.victoryPoints;
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans up nav." }];
    const summary = summarizeAnalysisLine(origin, entries, 0, 1);
    const { engine } = replayAnalysisLine(origin, entries, 0);
    expect(summary.label).to.equal("Plan B");
    expect(summary.moves).to.equal(1);
    expect(summary.applied).to.equal(1);
    expect(summary.victoryPoints).to.equal(engine.players[0].data.victoryPoints - base);
  });

  it("flags the unapplied move in an unaffordable line", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    origin.player(0).data.credits = 0;
    origin.player(0).data.ores = 0;
    const summary = summarizeAnalysisLine(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0, 0);
    expect(summary.moves).to.equal(1);
    expect(summary.applied).to.equal(0);
    expect(summary.overdrawn).to.equal(false);
  });

  // A line trimmed by a re-anchor must not be compared as if it were whole - `applied` below `moves`
  // is what the tab renders its "~" on.
  it("reports how much of the line actually replayed", () => {
    const origin = markAnalysisSeat(new Engine(SETUP_MOVES), 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans up nonsense." },
    ];
    const summary = summarizeAnalysisLine(origin, entries, 0, 0);
    expect(summary.moves).to.equal(2);
    expect(summary.applied).to.equal(1);
  });
});

describe("committableAnalysisMoves (§6, decision #13)", () => {
  it("commits the full move-only line when every move stays affordable without the sandbox grant", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans up nav." }];

    const moves = committableAnalysisMoves(origin, entries, 0);

    expect(moves).to.deep.equal(["terrans up nav."]);
  });

  it("excludes adjust entries from the committable result entirely, never counting them as a move", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "adjust", charge: 2 },
    ];

    const moves = committableAnalysisMoves(origin, entries, 0);

    expect(moves).to.deep.equal(["terrans up nav."]);
  });

  it("does not commit a move that only worked because of the real baseline covering it - the seat's true starting resources, not the sandbox grant, decide committability", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    origin.player(0).data.credits = 0;
    origin.player(0).data.ores = 0; // nothing real to spend - only the sandbox grant can pay for this
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans build ts -1x2." }];

    const moves = committableAnalysisMoves(origin, entries, 0);

    expect(moves).to.deep.equal([]);
  });

  it("commits every setup-phase move as-is, since setup carries no cost (no wallet is ever granted)", () => {
    const origin = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans build m -1x2" }];

    const moves = committableAnalysisMoves(origin, entries, 0);

    expect(moves).to.deep.equal(["terrans build m -1x2"]);
  });

  it("keeps an affordable prefix when a later upgrade needs a neighbour that is not there", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans up nav." },
      { kind: "move", move: "terrans build ts 4A4 cheap." },
    ];

    expect(committableAnalysisMoves(origin, entries, 0)).to.deep.equal(["terrans up nav."]);
    expect(analysisCommitPrefix(origin, entries, 0, 1).moves).to.deep.equal([
      "terrans up nav.",
      "terrans build ts 4A4 cheap.",
    ]);
  });

  it("returns nothing for a line with no move entries at all", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);

    expect(committableAnalysisMoves(origin, [], 0)).to.deep.equal([]);
    expect(committableAnalysisMoves(origin, [{ kind: "adjust", charge: 1 }], 0)).to.deep.equal([]);
  });

  it("truncates at an opponent's move, which setup pass-and-play puts in the line as an ordinary entry", () => {
    const origin = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans build m -1x2" },
      { kind: "move", move: "nevlas build m -1x0" }, // decision #7 - placed by me, for them
      { kind: "move", move: "nevlas build m 0x-4" },
    ];

    const moves = committableAnalysisMoves(origin, entries, 0);

    expect(moves).to.deep.equal(["terrans build m -1x2"]);
  });

  it("commits nothing at all from a line built on a faction seed - it describes a table that does not exist", () => {
    const origin = new Engine(["init 2 randomSeed"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] },
      { kind: "move", move: "terrans build m -1x2" },
    ];

    expect(committableAnalysisMoves(origin, entries, 0)).to.deep.equal([]);
  });
});

describe("analysisCommitPrefix - the cut reason behind the prefix", () => {
  it("includes the fourth move when the whole line is legal", () => {
    const origin = new Engine(SETUP_MOVES);
    origin.players[0].data.knowledge = 12;
    const moves = ["terrans up nav.", "terrans up terra.", "terrans up int.", "terrans pass booster4"];
    const entries: AnalysisEntry[] = moves.map((move) => ({ kind: "move", move }));
    expect(analysisCommitPrefix(origin, entries, 0)).to.deep.equal({ moves, cut: null });
  });

  it("requires enough resources in the simulated position even for future premoves", () => {
    const origin = new Engine(SETUP_MOVES);
    origin.players[0].data.knowledge = 0;
    const entries: AnalysisEntry[] = [
      { kind: "adjust", charge: 1 },
      { kind: "move", move: "terrans up nav." },
    ];
    expect(analysisCommitPrefix(origin, entries, 0, 0).moves).to.deep.equal([]);
    expect(analysisCommitPrefix(origin, entries, 0, 1).moves).to.deep.equal([]);
  });

  it("can queue a power action after explicit simulated charges, but cannot play it immediately", () => {
    const origin = new Engine(SETUP_MOVES);
    Object.assign(origin.players[0].data.power, { area1: 0, area2: 4, area3: 0 });
    const entries: AnalysisEntry[] = [
      { kind: "adjust", charge: 4 },
      { kind: "move", move: "terrans action power3." },
    ];
    expect(analysisCommitPrefix(origin, entries, 0, 0).moves).to.deep.equal(["terrans action power3."]);
    expect(analysisCommitPrefix(origin, entries, 0, 1).moves).to.deep.equal([]);
  });

  it("reports no cut for a line that is committable end to end", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);

    const { moves, cut } = analysisCommitPrefix(origin, [{ kind: "move", move: "terrans up nav." }], 0);

    expect(moves).to.deep.equal(["terrans up nav."]);
    expect(cut).to.equal(null);
  });

  it("rejects an older saved draft that spends past the seat's resources", () => {
    const origin = new Engine(SETUP_MOVES);
    applySoloRoundFlow(origin, 0);
    origin.player(0).data.credits = 0;
    origin.player(0).data.ores = 0;

    const { moves, cut } = analysisCommitPrefix(origin, [{ kind: "move", move: "terrans build ts -1x2." }], 0);

    expect(moves).to.deep.equal([]);
    expect(cut).to.equal("illegal");
  });

  it("rejects an imagined faction, but allows a future 3c-only upgrade with its constraint intact", () => {
    const seeded = new Engine(["init 2 randomSeed"]);
    applySoloRoundFlow(seeded, 0);
    expect(
      analysisCommitPrefix(seeded, [{ kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] }], 0).cut
    ).to.equal("faction");

    const origin = new Engine(SETUP_MOVES);
    const entries: AnalysisEntry[] = [{ kind: "move", move: "terrans build ts 4A4 cheap." }];
    expect(analysisCommitPrefix(origin, entries, 0, 0).moves).to.deep.equal(["terrans build ts 4A4 cheap."]);
    expect(analysisCommitPrefix(origin, entries, 0, 1).moves).to.deep.equal([]);
    expect(
      analysisCommitPrefix(origin, [{ kind: "move", move: "terrans build ts 3A3 cheap." }], 0, 1).moves
    ).to.deep.equal(["terrans build ts 3A3 cheap."]);
  });

  it("names the foreign move that setup pass-and-play left in the line", () => {
    const origin = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"]);
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [
      { kind: "move", move: "terrans build m -1x2" },
      { kind: "move", move: "nevlas build m -1x0" },
    ];

    const { moves, cut } = analysisCommitPrefix(origin, entries, 0);

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
    });

    expect(plan.live).to.equal("a");
    expect(plan.queued).to.deep.equal(["b", "c"]);
    expect(plan.dropped).to.deep.equal(["d", "e"]);
    expect(plan.limit).to.equal("line");
    expect(plan.cut).to.equal("overdrawn");
  });

  it("queues everything and plays nothing live off turn - there is no turn for a live move to go into", () => {
    const plan = planAnalysisCommit({
      committable: line,
      cut: null,
      lineMoves: line,
      onTurn: false,
      hosted: true,
    });

    expect(plan.live).to.equal(null);
    expect(plan.queued).to.deep.equal(line);
    expect(plan.dropped).to.deep.equal([]);
  });

  it("plays the first move and queues every remaining valid move without a count limit", () => {
    const plan = planAnalysisCommit({
      committable: line,
      cut: null,
      lineMoves: line,
      onTurn: true,
      hosted: true,
    });

    expect(plan.live).to.equal("a");
    expect(plan.queued).to.deep.equal(["b", "c", "d", "e"]);
    expect(plan.dropped).to.deep.equal([]);
    expect(plan.limit).to.equal("line");
    expect(plan.cut).to.equal(null);
  });

  it("commits move 1 only in self-contained play, which has no premove queue at all", () => {
    const plan = planAnalysisCommit({
      committable: ["a", "b", "c"],
      cut: null,
      lineMoves: ["a", "b", "c"],
      onTurn: true,
      hosted: false,
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
    });

    expect(plan.live).to.equal(null);
    expect(plan.queued).to.deep.equal([]);
    expect(plan.dropped).to.deep.equal(["a"]);
  });
});

describe("limitAnalysisCommit - program only the selected eligible prefix", () => {
  const moves = ["terrans up nav.", "terrans up gaia.", "terrans build ts -1x2 cheap."];
  const makePlan = (onTurn = true): AnalysisCommitPlan => ({
    ...planAnalysisCommit({
      committable: moves,
      lineMoves: [...moves, "terrans unavailable"],
      cut: "illegal",
      onTurn,
      hosted: true,
    }),
    timings: [
      { round: 1, phase: Phase.RoundMove },
      { round: 2, phase: Phase.RoundMove },
      { round: 3, phase: Phase.RoundMove },
    ],
    costs: [
      [{ type: Resource.Knowledge, count: 4 }],
      [{ type: Resource.Knowledge, count: 4 }],
      [{ type: Resource.Credit, count: 3 }],
    ],
  });

  for (const onTurn of [true, false]) {
    it(`selects a prefix ${onTurn ? "including the live move" : "entirely from the off-turn queue"}`, () => {
      const plan = makePlan(onTurn);
      const before = JSON.parse(JSON.stringify(plan));
      const limited = limitAnalysisCommit(plan, 2);
      expect(limited.live).to.equal(onTurn ? moves[0] : null);
      expect(limited.queued).to.deep.equal(onTurn ? [moves[1]] : moves.slice(0, 2));
      expect(limited.deferred).to.deep.equal([moves[2]]);
      expect(limited.dropped).to.deep.equal(plan.dropped);
      expect(limited.cut).to.equal("illegal");
      expect(limited.limit).to.equal("line");
      expect(limited.timings).to.deep.equal(plan.timings.slice(0, 2));
      expect(limited.costs).to.deep.equal(plan.costs.slice(0, 2));
      expect(limited.simulatedNeighbour).to.equal(false);
      expect(limited.queued).not.to.equal(plan.queued);
      expect(limited.timings).not.to.equal(plan.timings);
      expect(limited.costs).not.to.equal(plan.costs);
      expect(plan).to.deep.equal(before);
    });
  }

  it("counts an immediate move as the first selected move, not as an extra queue slot", () => {
    const plan = makePlan();
    const limited = limitAnalysisCommit(plan, 1);
    expect(limited.live).to.equal(moves[0]);
    expect(limited.queued).to.deep.equal([]);
    expect(limited.timings).to.deep.equal(plan.timings.slice(0, 1));
    expect(limited.costs).to.deep.equal(plan.costs.slice(0, 1));
    expect(limited.deferred).to.deep.equal(moves.slice(1));
  });

  for (const count of [NaN, Infinity, -Infinity, -1, 1.5, 0]) {
    it(`selects nothing for invalid count ${count}`, () => {
      const plan = makePlan();
      const limited = limitAnalysisCommit(plan, count);
      expect(limited.live).to.equal(null);
      expect(limited.queued).to.deep.equal([]);
      expect(limited.timings).to.deep.equal([]);
      expect(limited.costs).to.deep.equal([]);
      expect(limited.deferred).to.deep.equal(moves);
      expect(limited.dropped).to.deep.equal(plan.dropped);
      expect(limited.cut).to.equal(plan.cut);
      expect(limited.limit).to.equal(plan.limit);
      expect(limited.simulatedNeighbour).to.equal(false);
    });
  }

  for (const count of [3, 100]) {
    it(`keeps the full eligible prefix for count ${count}, including its neighbour requirement`, () => {
      const plan = makePlan();
      const limited = limitAnalysisCommit(plan, count);
      expect(limited.live).to.equal(plan.live);
      expect(limited.queued).to.deep.equal(plan.queued);
      expect(limited.timings).to.deep.equal(plan.timings);
      expect(limited.costs).to.deep.equal(plan.costs);
      expect(limited.deferred).to.deep.equal([]);
      expect(limited.dropped).to.deep.equal(plan.dropped);
      expect(limited.simulatedNeighbour).to.equal(true);
    });
  }

  it("preserves optional metadata when absent and never expands offline eligibility", () => {
    for (const onTurn of [true, false]) {
      const plan = planAnalysisCommit({ committable: moves, lineMoves: moves, cut: null, onTurn, hosted: false });
      const limited = limitAnalysisCommit(plan, 100);
      expect(limited.live).to.equal(onTurn ? moves[0] : null);
      expect(limited.queued).to.deep.equal([]);
      expect(limited.deferred).to.deep.equal([]);
      expect(limited.dropped).to.deep.equal(onTurn ? moves.slice(1) : moves);
      expect(limited.limit).to.equal("no-premoves");
      expect(limited.cut).to.equal(null);
      expect(limited.timings).to.equal(undefined);
      expect(limited.costs).to.equal(undefined);
    }
  });

  it("can narrow a plan repeatedly without reviving deferred moves or losing their order", () => {
    const plan = makePlan();
    const first = limitAnalysisCommit(plan, 2);
    const second = limitAnalysisCommit(first, 1);
    const expanded = limitAnalysisCommit(second, 100);
    expect(first.deferred).to.deep.equal([moves[2]]);
    expect(second.deferred).to.deep.equal(moves.slice(1));
    expect(expanded).to.deep.equal(second);
    expect(expanded.dropped).to.deep.equal(plan.dropped);
    expect(limitAnalysisCommit(second, 0).deferred).to.deep.equal(moves);
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
    // Only our own placements and booster are simulated; opponents keep their current boards.
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Terrans, Faction.Nevlas] }];

    // Follow the engine’s placement offers for this faction.
    for (let i = 0; i < 4; i++) {
      const { engine } = replayAnalysisLine(origin, entries, 0);
      if (engine.phase !== Phase.SetupBuilding) {
        break;
      }
      expect(engine.playerToMove, "only this seat is ever asked to place").to.equal(0);
      const first = engine.findAvailableCommand(0, Command.Build).data.buildings[0];
      entries.push({ kind: "move", move: `terrans build ${first.building} ${first.coordinates}` });
    }

    const mid = replayAnalysisLine(origin, entries, 0);
    expect(mid.engine.phase).to.equal(Phase.SetupBooster);
    expect(mid.engine.playerToMove).to.equal(0); // nevlas' pick was skipped
    expect(mid.engine.players[1].data.occupied).to.have.length(0);
    const mine = mid.engine.findAvailableCommand(0, Command.ChooseRoundBooster).data.boosters[0];
    entries.push({ kind: "move", move: `terrans booster ${mine}` });

    const { engine, applied } = replayAnalysisLine(origin, entries, 0);

    expect(applied).to.equal(entries.length);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.round).to.equal(Round.Round1);
    expect(engine.turnOrder).to.deep.equal([0]); // solo from here (§2.5)
    expect(engine.playerToMove).to.equal(0);
    // Skipped opponents neither consume boosters nor add moves to the history.
    expect(engine.moveHistory.slice(origin.moveHistory.length).every((move) => move.startsWith("terrans "))).to.equal(
      true
    );
    expect(engine.players[1].data.tiles.booster ?? null).to.equal(null);
    expect(engine.tiles.boosters[mine]).to.equal(false);
    expect(Object.values(engine.tiles.boosters).filter((available) => available === false)).to.have.length(1);
  });

  it("does the same from an auction game's bid phase, taking the faction the auction had not yet awarded", () => {
    const origin = biddingGame();
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Nevlas, Faction.Terrans] }];

    const { engine, applied } = replayAnalysisLine(origin, entries, 0);

    expect(applied).to.equal(1);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(engine.players[0].faction).to.equal(Faction.Nevlas);
  });

  it("replays to the same table every time, since the lineup travels with the entry", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0);
    const entries: AnalysisEntry[] = [{ kind: "faction", lineup: [Faction.Itars, Faction.Terrans] }];

    const first = replayAnalysisLine(origin, entries, 0);
    const second = replayAnalysisLine(origin, entries, 0);

    expect(first.engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
    expect(second.engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Terrans]);
  });

  it("leaves the origin untouched, like every other entry kind", () => {
    const origin = freshGame();
    applySoloRoundFlow(origin, 0);
    const before = JSON.stringify(origin);

    replayAnalysisLine(origin, [{ kind: "faction", lineup: [Faction.Itars, Faction.Terrans] }], 0);

    expect(JSON.stringify(origin)).to.equal(before);
  });

  it("stops the line at a seed that can no longer apply, exactly like an illegal move", () => {
    const origin = new Engine(SETUP_MOVES); // already past faction selection
    const entries: AnalysisEntry[] = [
      { kind: "faction", lineup: [Faction.Itars, Faction.Terrans] },
      { kind: "move", move: "terrans up nav." },
    ];

    const { applied } = replayAnalysisLine(origin, entries, 0);

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
