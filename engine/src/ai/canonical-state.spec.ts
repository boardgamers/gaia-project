import { expect } from "chai";
import Engine, { AuctionVariant, EngineOptions } from "../engine";
import {
  ArtifactToken,
  BoardAction,
  Building,
  Operator,
  Phase,
  Player as PlayerEnum,
  ResearchField,
  Spaceship,
} from "../enums";
import {
  CANONICAL_STATE_SCHEMA_VERSION,
  canonicalJson,
  canonicalStateHash,
  canonicalStateJson,
  CanonicalStateError,
  projectCanonicalState,
} from "./canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "./challenge";
import { bootChallengeEngine } from "./challenge-manifest";

type CorpusEntry = {
  id: string;
  moves: string[];
  options: EngineOptions;
  expectedHash?: string;
};

const BASE_SETUP_FACTION_MOVES = ["init 2 12"];
const BASE_ROUND1_START_MOVES = [
  "init 2 12",
  "p1 faction terrans",
  "p2 faction hadsch-hallas",
  "terrans build m 1B1",
  "hadsch-hallas build m 5A5",
  "hadsch-hallas build m 1A10",
  "terrans build m 3A7",
  "hadsch-hallas booster booster1",
  "terrans booster booster2",
];
const BASE_LEECH_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
  "nevlas build m 0x-4",
  "terrans build m -4x-1",
  "nevlas booster booster7",
  "terrans booster booster3",
  "terrans build ts -1x2. endturn",
];

const CORPUS: CorpusEntry[] = [
  {
    id: "base-setup-faction",
    moves: BASE_SETUP_FACTION_MOVES,
    options: {},
  },
  {
    id: "base-round1-start",
    moves: BASE_ROUND1_START_MOVES,
    options: {},
  },
  {
    id: "base-round1-leech",
    moves: BASE_LEECH_MOVES,
    options: {},
  },
  {
    id: "phase0-challenge",
    moves: [...LOST_FLEET_CHALLENGE.scriptedPrefix],
    options: challengeEngineOptions(),
  },
];

function cloneOptions<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildEngine(entry: CorpusEntry): Engine {
  return new Engine([...entry.moves], cloneOptions(entry.options));
}

function reverseObjectKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => reverseObjectKeys(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    const result: Record<string, unknown> = {};

    for (const [key, entry] of entries) {
      result[key] = reverseObjectKeys(entry);
    }

    return result as T;
  }

  return value;
}

describe("canonical-state", () => {
  it("uses the expected schema version", () => {
    expect(CANONICAL_STATE_SCHEMA_VERSION).to.equal("gaia-ai-canonical-state/v1");
  });

  it("projects the fixed Phase 0 challenge state", () => {
    const engine = bootChallengeEngine();
    const canonical = projectCanonicalState(engine);

    expect(canonical.schemaVersion).to.equal(CANONICAL_STATE_SCHEMA_VERSION);
    expect(canonical.phase).to.equal(Phase.SetupBuilding);
    expect(canonical.options.lostFleet).to.equal(true);
    expect(canonical.players.map((player) => player.faction)).to.deep.equal(["xenos", "hadsch-hallas"]);
  });

  it("is byte-identical when projecting the same committed state repeatedly", () => {
    for (const entry of CORPUS) {
      const engine = buildEngine(entry);

      expect(canonicalStateJson(engine)).to.equal(canonicalStateJson(engine), entry.id);
      expect(canonicalStateHash(engine)).to.equal(canonicalStateHash(engine), entry.id);
    }
  });

  it("matches across constructor replay, slowMotion replay, and serialize/parse hydration", () => {
    for (const entry of CORPUS) {
      const constructorState = buildEngine(entry);
      const slowMotionState = Engine.slowMotion(
        [...entry.moves],
        cloneOptions(entry.options),
        constructorState.version
      );
      const hydratedState = Engine.fromData(JSON.parse(JSON.stringify(constructorState)));

      const constructorJson = canonicalStateJson(constructorState);
      const slowMotionJson = canonicalStateJson(slowMotionState);
      const hydratedJson = canonicalStateJson(hydratedState);

      expect(slowMotionJson).to.equal(constructorJson, `${entry.id} slowMotion parity`);
      expect(hydratedJson).to.equal(constructorJson, `${entry.id} hydration parity`);
      expect(canonicalStateHash(slowMotionState)).to.equal(
        canonicalStateHash(constructorState),
        `${entry.id} slowMotion hash`
      );
      expect(canonicalStateHash(hydratedState)).to.equal(
        canonicalStateHash(constructorState),
        `${entry.id} hydration hash`
      );
    }
  });

  it("does not depend on object identity or object-key insertion order", () => {
    const engine = buildEngine(CORPUS[2]);
    const equivalentEngine = buildEngine(CORPUS[2]);
    const reversedJson = reverseObjectKeys(JSON.parse(JSON.stringify(engine)));
    const reversedEngine = Engine.fromData(reversedJson);
    const projected = projectCanonicalState(engine);
    const reversedProjected = reverseObjectKeys(projected);

    expect(canonicalStateHash(equivalentEngine)).to.equal(canonicalStateHash(engine));
    expect(canonicalStateHash(reversedEngine)).to.equal(canonicalStateHash(engine));
    expect(canonicalJson(reversedProjected)).to.equal(canonicalJson(projected));
  });

  it("changes the hash when future-relevant base-game fields change", () => {
    const mutations = [
      {
        id: "engine-version",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.version = "4.8.50";
        },
      },
      {
        id: "federation-option",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.options.noFedCheck = true;
        },
      },
      {
        id: "current-player",
        build: () => buildEngine(CORPUS[1]),
        mutate: (engine: Engine) => {
          engine.currentPlayer = PlayerEnum.Player2;
        },
      },
      {
        id: "passed-players",
        build: () => buildEngine(CORPUS[1]),
        mutate: (engine: Engine) => {
          engine.passedPlayers = [PlayerEnum.Player1];
        },
      },
      {
        id: "board-action-owner",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.boardActions[BoardAction.Power1] = PlayerEnum.Player1;
        },
      },
      {
        id: "map-hex-state",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          const hex = engine.map.getS("-1x0");
          hex.data.tradeTokens = [PlayerEnum.Player1];
        },
      },
      {
        id: "player-resource",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.players[0].data.credits += 1;
        },
      },
      {
        id: "player-research",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.players[0].data.research[ResearchField.Terraforming] += 1;
        },
      },
      {
        id: "player-income-event-activation",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.players[0].events[Operator.Income][0].activated = true;
        },
      },
      {
        id: "leech-offer",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.players[1].data.leechPossible += 1;
        },
      },
      {
        id: "federation-cache",
        build: () => buildEngine(CORPUS[2]),
        mutate: (engine: Engine) => {
          engine.players[0].federationCache = {
            availableSatellites: 2,
            custom: false,
            federations: [],
          };
        },
      },
    ];

    for (const testCase of mutations) {
      const original = testCase.build();
      const changed = Engine.fromData(JSON.parse(JSON.stringify(original)));

      testCase.mutate(changed);

      expect(canonicalStateHash(changed)).to.not.equal(canonicalStateHash(original), testCase.id);
    }
  });

  it("changes the hash when future-relevant Lost Fleet fields change", () => {
    const original = bootChallengeEngine();
    const changed = Engine.fromData(JSON.parse(JSON.stringify(original)));

    changed.lostFleetTerraformingRow = [...changed.lostFleetTerraformingRow].reverse();
    changed.players[0].data.explorationShips[Spaceship.Twilight] = 1;
    changed.players[0].data.artifacts = [ArtifactToken.Credit];

    expect(canonicalStateHash(changed)).to.not.equal(canonicalStateHash(original));
  });

  it("ignores excluded cache and log fields", () => {
    const original = buildEngine(CORPUS[1]);
    const mutations = [
      (engine: Engine) => {
        engine.availableCommands = [{ name: "pass", player: PlayerEnum.Player1 } as any];
      },
      (engine: Engine) => {
        engine.availableCommand = { name: "pass", player: PlayerEnum.Player1 } as any;
      },
      (engine: Engine) => {
        engine.moveHistory = [...engine.moveHistory, "display-only move"];
      },
      (engine: Engine) => {
        engine.advancedLog = [...engine.advancedLog, { player: PlayerEnum.Player1, move: 999 }];
      },
      (engine: Engine) => {
        engine.players[0].settings.autoIncome = !engine.players[0].settings.autoIncome;
      },
      (engine: Engine) => {
        engine.players[0].name = "display-name";
      },
      (engine: Engine) => {
        engine.map.distanceCache = { "-1x2": { "-1x0": 42 } };
      },
      (engine: Engine) => {
        engine.replayVersion = "display-only";
      },
      (engine: Engine) => {
        engine.oldPhase = Phase.RoundIncome;
      },
      (engine: Engine) => {
        engine.processedPlayer = PlayerEnum.Player2;
      },
    ];

    for (const mutate of mutations) {
      const changed = Engine.fromData(JSON.parse(JSON.stringify(original)));
      mutate(changed);
      expect(canonicalStateHash(changed)).to.equal(canonicalStateHash(original));
    }
  });

  it("rejects incomplete transient states", () => {
    const engine = buildEngine(CORPUS[1]);
    engine.move("terrans build ts 1B1");

    expect(engine.newTurn).to.equal(false);
    expect(() => canonicalStateJson(engine)).to.throw(CanonicalStateError);
  });

  it("rejects unsupported faction-picking variants outside the standard flow", () => {
    const silentAuction = new Engine(
      Engine.parseMoves(`
        init 3 djfjjv4k
        p1 banFaction terrans
        p2 banFaction lantids
        p3 banFaction hadsch-hallas
        p1 faction itars
        p2 faction xenos
        p3 faction taklons
        p1 silentBid itars 15 xenos 0 taklons 10
        p2 silentBid itars 15 xenos 5 taklons 8
        p3 silentBid itars 7 xenos 0 taklons 0
      `),
      { auction: AuctionVariant.Silent }
    );
    const randomFactions = new Engine(["init 3 12"], { randomFactions: true });
    const banPhase = new Engine(["init 2 12"], { banPhase: true });

    expect(() => canonicalStateJson(silentAuction)).to.throw(CanonicalStateError);
    expect(() => canonicalStateJson(randomFactions)).to.throw(CanonicalStateError);
    expect(() => canonicalStateJson(banPhase)).to.throw(CanonicalStateError);
  });

  it("rejects Lost Fleet states missing persisted setup randomization", () => {
    const engine = bootChallengeEngine();
    delete (engine as any).lostFleetTerraformingRow;

    expect(() => canonicalStateJson(engine)).to.throw(CanonicalStateError);
  });

  it("covers a deterministic committed-state corpus", () => {
    const hashes = CORPUS.map((entry) => ({
      id: entry.id,
      hash: canonicalStateHash(buildEngine(entry)),
    }));

    expect(hashes).to.deep.equal([
      { id: "base-setup-faction", hash: "b36824fbb558554e49c3dc28caca1ac3a7488ed2377a31c129f9996bcde0deb7" },
      { id: "base-round1-start", hash: "c5ce7b35ff514c4f2747fcba805b7c599f2a388b0957e39459bea669f434ed94" },
      { id: "base-round1-leech", hash: "0763ec81011c759adcc5af75ceb154e741696488ecd75da258d578575e6fdf3f" },
      { id: "phase0-challenge", hash: "a702187a622f65eb375eeab5ef1275ea4423da545da2235adfd1507c32ae6c2a" },
    ]);
  });
});
