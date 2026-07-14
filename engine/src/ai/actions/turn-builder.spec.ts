import { createHash } from "crypto";
import { expect } from "chai";
import "mocha";
import { possibleBuildings } from "../../available/buildings";
import { possibleFederations } from "../../available/federations";
import Engine from "../../engine";
import { Building, Command, Federation, Phase, Player, ResearchField, Spaceship, TechTilePos } from "../../enums";
import Event from "../../events";
import { canonicalStateHash } from "../canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { planResourceConversions } from "../resources/planner";
import { AtomicExpansionError, expandAtomicDecisions } from "./expand";
import { buildCommittedTurnMacros, CommittedTurnMacro, CommittedTurnMacroSet } from "./turn-builder";

function hydrate(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove)?.faction ?? `p${engine.playerToMove + 1}`;
}

function lockedRoundOneEngine(): Engine {
  const engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard, "locked setup must terminate").to.be.greaterThan(0);
  }
  expect(engine.phase).to.equal(Phase.RoundMove);
  return engine;
}

function hadschHallasTurn(): Engine {
  const engine = lockedRoundOneEngine();
  const pass = expandAtomicDecisions(engine).candidates.find((candidate) => candidate.command === Command.Pass);
  engine.move(`${actorPrefix(engine)} ${pass.moveFragment}`);
  expect(engine.player(engine.playerToMove).faction).to.equal("hadsch-hallas");
  return engine;
}

function smallWallet(
  engine: Engine,
  wallet: Partial<{
    credits: number;
    ores: number;
    knowledge: number;
    qics: number;
    area1: number;
    area2: number;
    area3: number;
  }>
): Engine {
  const player = engine.player(engine.playerToMove);
  player.data.credits = wallet.credits ?? 0;
  player.data.ores = wallet.ores ?? 0;
  player.data.knowledge = wallet.knowledge ?? 0;
  player.data.qics = wallet.qics ?? 0;
  player.data.power.area1 = wallet.area1 ?? 0;
  player.data.power.area2 = wallet.area2 ?? 0;
  player.data.power.area3 = wallet.area3 ?? 0;
  player.data.power.gaia = 0;
  player.data.brainstone = null;
  engine.clearAvailableCommands();
  player.federationCache = null;
  return engine;
}

/** Host-style verification: fresh clone, one `move()`, committed, same canonical destination. */
function applyMacroHostStyle(source: Engine, macro: CommittedTurnMacro): Engine {
  const clone = hydrate(source);
  clone.move(macro.moveLine);
  expect(clone.newTurn, `macro ${macro.moveLine} must commit`).to.equal(true);
  expect(canonicalStateHash(clone)).to.equal(macro.destination.stateHash);
  expect(clone.playerToMove ?? null).to.equal(macro.destination.nextActor);
  return clone;
}

function macroSetDigest(macroSet: CommittedTurnMacroSet): string {
  return createHash("sha256")
    .update(macroSet.macros.map((macro) => `${macro.key}\0${macro.destination.stateHash}`).join("\n"))
    .digest("hex");
}

function assertWellFormed(macroSet: CommittedTurnMacroSet): void {
  const keys = macroSet.macros.map((macro) => macro.key);
  expect(new Set(keys).size).to.equal(keys.length);
  expect(keys).to.deep.equal([...keys].sort());
  for (const macro of macroSet.macros) {
    expect(macro.key).to.match(/^macro-v1:[0-9a-f]{64}$/);
    expect(macro.moveFragments.length).to.be.greaterThan(0);
    expect(macro.moveFragments.every((fragment) => fragment.length > 0 && !fragment.includes("."))).to.equal(true);
    for (const decision of macro.decisions) {
      if (decision.kind === "forced-follow-up") {
        expect(decision.options).to.equal(1);
        expect(macro.followUpChoiceKeys).to.not.include(decision.candidateKey);
      }
      if (decision.kind === "choice-follow-up") {
        expect(decision.options).to.be.greaterThan(1);
      }
    }
  }
}

describe("Phase 1.4 committed-turn macro builder", function () {
  // Macro construction replays every candidate line against fresh clones; the heavier cases
  // (federation geometry, conversion integration) legitimately exceed mocha's 2s default.
  this.timeout(10 * 60 * 1000);

  it("builds committed macros for the Phase 0 setup state through the generic decision path", () => {
    const setup = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
    const expansion = expandAtomicDecisions(setup);
    const macroSet = buildCommittedTurnMacros(setup);

    expect(setup.phase).to.equal(Phase.SetupBuilding);
    expect(macroSet.macros).to.have.length(expansion.candidates.length);
    expect(macroSet.rejected).to.have.length(0);
    assertWellFormed(macroSet);
    for (const macro of macroSet.macros) {
      expect(macro.mainCommand).to.equal(Command.Build);
      expect(macro.conversionPlanKey).to.equal(null);
      applyMacroHostStyle(setup, macro);
    }
  });

  it("locks the Round-1 macro set without conversion integration and applies every macro", () => {
    const source = lockedRoundOneEngine();
    const macroSet = buildCommittedTurnMacros(source, { conversionIntegration: false });

    expect(macroSet.statistics.macroCount).to.equal(52);
    expect(macroSet.statistics.mainCandidateCount).to.equal(32);
    expect(macroSet.statistics.conversionPlanCount).to.equal(0);
    expect(macroSet.statistics.rejectedLineCount).to.equal(0);
    expect(macroSet.statistics.deduplicationCount).to.equal(0);
    expect(macroSetDigest(macroSet)).to.equal("972a1e9b062ebcda5a96e2242039bbc29eee83934c9eb41e175a493bb1009096");
    assertWellFormed(macroSet);

    const passMacro = macroSet.macros.find((macro) => macro.mainCommand === Command.Pass);
    expect(passMacro).to.not.equal(undefined);
    for (const macro of macroSet.macros) {
      const committed = applyMacroHostStyle(source, macro);
      expect([Phase.RoundMove, Phase.RoundLeech]).to.include(committed.phase);
      if (macro.mainCommand !== Command.Pass) {
        expect(macro.moveFragments[macro.moveFragments.length - 1]).to.equal(Command.EndTurn);
      }
    }
    const choiceMacros = macroSet.macros.filter((macro) => macro.followUpChoiceKeys.length > 0);
    expect(choiceMacros.length, "special range+3 build targets must branch").to.be.greaterThan(1);
  });

  it("keeps macro keys and committed destination hashes stable across replay paths", () => {
    const base = lockedRoundOneEngine();
    const sources = [
      base,
      new Engine(base.moveHistory, challengeEngineOptions(), base.version),
      Engine.slowMotion(base.moveHistory, challengeEngineOptions(), base.version),
      hydrate(base),
    ];
    const projections = sources.map((source) =>
      buildCommittedTurnMacros(source, { conversionIntegration: false }).macros.map((macro) => [
        macro.key,
        macro.destination.stateHash,
      ])
    );
    for (const projection of projections.slice(1)) {
      expect(projection).to.deep.equal(projections[0]);
    }
  });

  it("keeps forced one-choice follow-ups out of policy branching and macro keys", () => {
    const engine = lockedRoundOneEngine();
    const player = engine.player(Player.Player1);
    const hex = player.data.occupied[0];
    hex.data.building = Building.TradingStation;
    player.data.buildings[Building.Mine] -= 1;
    player.data.buildings[Building.TradingStation] = 1;
    player.data.ores = 20;
    player.data.credits = 30;
    player.data.knowledge = 20;
    player.federationCache = null;
    engine.availableCommands = possibleBuildings(engine, Player.Player1);
    const labKey = expandAtomicDecisions(engine).candidates.find(
      (candidate) => candidate.command === Command.Build && candidate.target.building === Building.ResearchLab
    ).key;

    const macroSet = buildCommittedTurnMacros(engine, {
      conversionIntegration: false,
      mainCandidateKeys: [labKey],
    });
    assertWellFormed(macroSet);
    expect(macroSet.macros.length).to.be.greaterThan(1);

    // A field tech tile's follow-up is a genuine two-way decision (advance or decline the free
    // step); both stay distinct macros and neither is misclassified as forced.
    const fieldMacros = macroSet.macros.filter((macro) =>
      macro.moveFragments.includes(`${Command.ChooseTechTile} ${TechTilePos.Terraforming}`)
    );
    expect(fieldMacros).to.have.length(2);
    expect(fieldMacros.some((macro) => macro.moveFragments.includes(`${Command.UpgradeResearch} terra`))).to.equal(
      true
    );
    expect(fieldMacros.some((macro) => macro.moveFragments.includes(Command.Decline))).to.equal(true);
    for (const macro of fieldMacros) {
      expect(
        macro.decisions.some((decision) => decision.kind === "choice-follow-up" && decision.options === 2)
      ).to.equal(true);
    }

    // A free tech tile leaves the research advance as a wider choice: one macro per option.
    const freeMacros = macroSet.macros.filter((macro) =>
      macro.moveFragments.includes(`${Command.ChooseTechTile} ${TechTilePos.Free1}`)
    );
    expect(freeMacros.length).to.be.greaterThan(2);
    for (const macro of freeMacros) {
      expect(macro.decisions.some((decision) => decision.kind === "choice-follow-up")).to.equal(true);
    }
    for (const macro of macroSet.macros) {
      applyMacroHostStyle(engine, macro);
    }

    // When the player already owns every other standard tech tile, the pick becomes a forced
    // one-choice follow-up: it stays on the line's spine, never multiplies macros, and never
    // enters the macro key.
    const forcedEngine = hydrate(engine);
    const forcedPlayer = forcedEngine.player(Player.Player1);
    for (const position of TechTilePos.values(forcedEngine.expansions)) {
      if (position !== TechTilePos.Terraforming) {
        forcedPlayer.data.tiles.techs.push({
          tile: forcedEngine.tiles.techs[position].tile,
          pos: position,
          enabled: true,
        });
      }
    }
    forcedEngine.clearAvailableCommands();
    forcedEngine.availableCommands = possibleBuildings(forcedEngine, Player.Player1);
    const forcedLabKey = expandAtomicDecisions(forcedEngine).candidates.find(
      (candidate) => candidate.command === Command.Build && candidate.target.building === Building.ResearchLab
    ).key;
    const forcedSet = buildCommittedTurnMacros(forcedEngine, {
      conversionIntegration: false,
      mainCandidateKeys: [forcedLabKey],
    });
    assertWellFormed(forcedSet);
    expect(forcedSet.macros).to.have.length(2);
    for (const macro of forcedSet.macros) {
      const forced = macro.decisions.filter((decision) => decision.kind === "forced-follow-up");
      expect(forced.map((decision) => decision.command)).to.deep.equal([Command.ChooseTechTile]);
      expect(macro.forcedFollowUpKeys).to.have.length(1);
      applyMacroHostStyle(forcedEngine, macro);
    }
  });

  it("locks the before/after conversion-integration branch statistics for the locked state", function () {
    const source = lockedRoundOneEngine();
    const before = buildCommittedTurnMacros(source, { conversionIntegration: false });
    expect(before.statistics.macroCount).to.equal(52);
    expect(before.statistics.mainCandidateCount).to.equal(32);

    // The complete integrated branch factor is measured at the seed level from the locked Phase
    // 1.3 result: one macro line per (nondominated conversion prefix, main candidate) pair. Fully
    // emitting all ~130k lines replays each one and is a measured multi-hour offline job on this
    // state, so the lock here counts the exact seed pairs instead of constructing every line.
    const planning = planResourceConversions(source);
    expect(planning.candidates).to.have.length(45);
    let seedPairs = 0;
    let nonEmptyPrefixPairs = 0;
    for (const entry of planning.candidates) {
      const uniquePlans = new Set(entry.payments.frontier.map((payment) => payment.conversionPlanKey));
      seedPairs += uniquePlans.size;
      for (const plan of entry.plans) {
        if (uniquePlans.has(plan.key) && plan.steps.length > 0) {
          nonEmptyPrefixPairs += 1;
        }
      }
    }
    expect(seedPairs).to.equal(130_532);
    expect(nonEmptyPrefixPairs).to.equal(130_500);
    expect(seedPairs - nonEmptyPrefixPairs, "empty-prefix seeds must be the root-affordable mains").to.equal(32);
  });

  it("integrates nondominated conversion prefixes without duplicating equivalent orders", () => {
    const source = smallWallet(hadschHallasTurn(), { knowledge: 1, qics: 1, credits: 2, ores: 1 });
    const off = buildCommittedTurnMacros(source, { conversionIntegration: false });
    const on = buildCommittedTurnMacros(source, {
      conversionIntegration: true,
      afterConversionIntegration: false,
    });
    assertWellFormed(on);

    expect(on.statistics.conversionIntegration).to.equal(true);
    expect(on.statistics.macroCount).to.be.greaterThan(off.statistics.macroCount);
    expect(on.statistics.conversionPlanCount).to.be.greaterThan(0);
    expect(on.deduplications).to.have.length(0);

    const onKeys = new Set(on.macros.map((macro) => macro.key));
    for (const macro of off.macros) {
      expect(onKeys.has(macro.key), `conversion-free macro ${macro.key} must keep its key`).to.equal(true);
    }

    const prefixed = on.macros.filter((macro) => macro.conversionPlanKey !== null);
    expect(prefixed.length).to.be.greaterThan(0);
    const byDestination = prefixed.map(
      (macro) =>
        `${macro.mainCandidateKey}\0${macro.conversionDestinationStateKey}\0${macro.followUpChoiceKeys.join(",")}\0${
          macro.afterConversionDestinationStateKey
        }`
    );
    expect(new Set(byDestination).size, "equivalent conversion prefixes must not duplicate macros").to.equal(
      byDestination.length
    );
    for (const macro of prefixed.slice(0, 10)) {
      applyMacroHostStyle(source, macro);
    }
  });

  it("retains AfterMove bowl-opening branches and defers ordinary conversions", () => {
    const source = smallWallet(lockedRoundOneEngine(), { ores: 1, knowledge: 4 });
    const main = expandAtomicDecisions(source).candidates.find(
      (candidate) => candidate.command === Command.UpgradeResearch
    );
    const macroSet = buildCommittedTurnMacros(source, {
      conversionIntegration: true,
      afterConversionIntegration: true,
      mainCandidateKeys: [main.key],
    });
    assertWellFormed(macroSet);

    const retained = macroSet.macros.filter((macro) => macro.afterConversionPlanKey !== null);
    const deferredOnly = macroSet.macros.filter(
      (macro) => macro.afterConversionPlanKey === null && macro.mainCandidateKey === main.key
    );
    expect(retained.length, "bowl-opening AfterMove branch must be retained").to.be.greaterThan(0);
    expect(deferredOnly.length, "the defer-everything branch must remain distinct").to.be.greaterThan(0);
    const opening = retained.find(
      (macro) => macro.moveFragments.includes("spend 1o for 1ta3") && macro.moveFragments.includes("spend 1pw for 1c")
    );
    expect(opening).to.not.equal(undefined);
    expect(opening.moveFragments[opening.moveFragments.length - 1]).to.equal(Command.EndTurn);
    for (const macro of [...retained, ...deferredOnly]) {
      applyMacroHostStyle(source, macro);
    }
    const keys = new Set(macroSet.macros.map((macro) => macro.key));
    expect(keys.size).to.equal(macroSet.macros.length);
  });

  it("records actor transition, pass order, and leech interruption on committed edges", () => {
    const passSource = lockedRoundOneEngine();
    const passMacro = buildCommittedTurnMacros(passSource, { conversionIntegration: false }).macros.find(
      (macro) => macro.mainCommand === Command.Pass
    );
    expect(passMacro.destination.actorPassed).to.equal(true);
    expect(passMacro.destination.passOrder).to.deep.equal([Player.Player1]);
    expect(passMacro.destination.nextActor).to.equal(Player.Player2);
    applyMacroHostStyle(passSource, passMacro);

    const leechSource = new Engine(
      [
        "init 2 randomSeed",
        "p1 faction terrans",
        "p2 faction nevlas",
        "terrans build m -1x2",
        "nevlas build m -1x0",
        "nevlas build m 0x-4",
        "terrans build m -4x-1",
        "nevlas booster booster7",
        "terrans booster booster3",
      ],
      {}
    );
    const buildMacro = buildCommittedTurnMacros(leechSource, { conversionIntegration: false }).macros.find(
      (macro) => macro.mainCommand === Command.Build && macro.destination.leechPending
    );
    expect(buildMacro).to.not.equal(undefined);
    expect(buildMacro.destination.phase).to.equal(Phase.RoundLeech);
    expect(buildMacro.destination.nextActor).to.equal(Player.Player2);

    const leechState = applyMacroHostStyle(leechSource, buildMacro);
    const leechMacros = buildCommittedTurnMacros(leechState);
    assertWellFormed(leechMacros);
    expect(leechMacros.actor).to.equal(Player.Player2);
    expect(leechMacros.macros.length).to.be.greaterThan(1);
    const commands = new Set(leechMacros.macros.map((macro) => macro.mainCommand));
    expect(commands.has(Command.ChargePower)).to.equal(true);
    expect(commands.has(Command.Decline)).to.equal(true);
    for (const macro of leechMacros.macros) {
      const committed = applyMacroHostStyle(leechState, macro);
      expect(committed.phase).to.equal(Phase.RoundMove);
      expect(committed.playerToMove).to.equal(Player.Player2);
    }
  });

  it("rejects dead-end lines before exposure instead of emitting them", () => {
    const source = smallWallet(lockedRoundOneEngine(), { area3: 20 });
    const macroSet = buildCommittedTurnMacros(source, { conversionIntegration: false });

    const deadEnds = macroSet.rejected.filter((line) => line.reason === "dead-end-follow-up");
    expect(deadEnds.length, "power6's forced mine with an empty wallet must dead-end").to.be.greaterThan(0);
    expect(deadEnds.some((line) => line.moveFragments[0] === "action power6")).to.equal(true);
    for (const macro of macroSet.macros) {
      expect(macro.moveFragments[0]).to.not.equal("action power6");
      applyMacroHostStyle(source, macro);
    }
  });

  it("excludes the custom-federation fallback rather than reading it as no federation", () => {
    const source = lockedRoundOneEngine();
    source.availableCommands = [
      {
        name: Command.FormFederation,
        player: Player.Player1,
        data: { tiles: [Federation.Fed2], federations: [], claimableFederations: [] },
      },
    ];

    // Custom (hand-picked hex set) federations are deliberately out of scope, so when the engine
    // offers a federation ONLY via that fallback (`federations: []`) the AI forms no federation
    // this turn and drops the offer — but the drop is recorded for audit, not silent, and the
    // macro set is never left with a spurious FormFederation macro. Phase 1.2 keeps rejecting the
    // raw command outright.
    const macroSet = buildCommittedTurnMacros(source, { conversionIntegration: false });
    expect(macroSet.excludedCustomFederationTiles).to.deep.equal([Federation.Fed2]);
    expect(macroSet.statistics.excludedCustomFederationCount).to.equal(1);
    expect(macroSet.macros.map((macro) => macro.mainCommand)).to.not.include(Command.FormFederation);

    expect(() => expandAtomicDecisions(source))
      .to.throw(AtomicExpansionError)
      .with.property("code", "empty-command-data");

    const supported = lockedRoundOneEngine();
    const supportedSet = buildCommittedTurnMacros(supported, { conversionIntegration: false });
    expect(supportedSet.excludedCustomFederationTiles).to.deep.equal([]);
    expect(supportedSet.statistics.excludedCustomFederationCount).to.equal(0);
  });

  it("builds income-ordering macros through the generic committed decision path", () => {
    const income = lockedRoundOneEngine();
    income.phase = Phase.RoundIncome;
    income.currentPlayer = Player.Player1;
    income.tempTurnOrder = [Player.Player2];
    income.player(Player.Player1).loadEvents(Event.parse(["+1t", "+2pw"], Command.ChooseIncome));
    income.clearAvailableCommands();

    const macroSet = buildCommittedTurnMacros(income);
    assertWellFormed(macroSet);
    expect(macroSet.macros.length).to.be.greaterThan(1);
    for (const macro of macroSet.macros) {
      expect(macro.mainCommand).to.equal(Command.ChooseIncome);
      applyMacroHostStyle(income, macro);
    }
  });

  it("covers the remaining locked follow-up families with explicit macro construction", () => {
    // Ship federation with the claimed-ship reward branch (FederationTokenBuildMine window).
    const federation = lockedRoundOneEngine();
    const fedPlayer = federation.player(Player.Player1);
    const structures = [Building.PlanetaryInstitute, Building.Academy1, Building.Academy2];
    fedPlayer.data.occupied.forEach((hex, index) => {
      hex.data.building = structures[index];
    });
    fedPlayer.data.buildings[Building.Mine] = 0;
    fedPlayer.data.buildings[Building.PlanetaryInstitute] = 1;
    fedPlayer.data.buildings[Building.Academy1] = 1;
    fedPlayer.data.buildings[Building.Academy2] = 1;
    fedPlayer.data.power.area1 = 20;
    fedPlayer.data.ores = 20;
    fedPlayer.data.qics = 20;
    fedPlayer.data.explorationShips[Spaceship.Twilight] = 1;
    fedPlayer.federationCache = null;
    federation.availableCommands = possibleFederations(federation, Player.Player1);
    const federationSet = buildCommittedTurnMacros(federation, { conversionIntegration: false });
    assertWellFormed(federationSet);
    const federationMacros = federationSet.macros.filter((macro) => macro.mainCommand === Command.FormFederation);
    expect(federationMacros.length).to.be.greaterThan(0);
    for (const macro of federationMacros.slice(0, 6)) {
      applyMacroHostStyle(federation, macro);
    }

    // Examine Artifact and its artifact-token choice.
    const artifacts = lockedRoundOneEngine();
    artifacts.player(Player.Player1).data.explorationShips[Spaceship.Twilight] = 1;
    artifacts.player(Player.Player1).data.qics = 20;
    artifacts.clearAvailableCommands();
    const artifactSet = buildCommittedTurnMacros(artifacts, { conversionIntegration: false });
    const artifactMacros = artifactSet.macros.filter((macro) => macro.mainCommand === Command.ExamineArtifact);
    expect(artifactMacros.length).to.be.greaterThan(1);
    expect(
      artifactMacros.every((macro) =>
        macro.decisions.some(
          (decision) => decision.kind === "choice-follow-up" && decision.command === Command.ChooseArtifactToken
        )
      )
    ).to.equal(true);
    for (const macro of artifactMacros.slice(0, 4)) {
      applyMacroHostStyle(artifacts, macro);
    }

    // Navigation 5 forces the Lost Planet placement branch.
    const lostPlanet = lockedRoundOneEngine();
    const lostPlayer = lostPlanet.player(Player.Player1);
    lostPlayer.data.research[ResearchField.Navigation] = 4;
    lostPlayer.data.tiles.federations.push({ tile: Federation.Fed2, green: true });
    lostPlayer.data.knowledge = 20;
    lostPlanet.clearAvailableCommands();
    const lostSet = buildCommittedTurnMacros(lostPlanet, { conversionIntegration: false });
    const lostMacros = lostSet.macros.filter((macro) =>
      macro.moveFragments.includes(`${Command.UpgradeResearch} ${ResearchField.Navigation}`)
    );
    expect(lostMacros.length).to.be.greaterThan(0);
    expect(
      lostMacros.every((macro) => macro.decisions.some((decision) => decision.command === Command.PlaceLostPlanet))
    ).to.equal(true);
    for (const macro of lostMacros.slice(0, 3)) {
      applyMacroHostStyle(lostPlanet, macro);
    }

    // TF Mars power action chains instant gaiaforming.
    const tfMars = lockedRoundOneEngine();
    const tfPlayer = tfMars.player(Player.Player1);
    tfPlayer.data.explorationShips[Spaceship.TFMars] = 1;
    tfPlayer.data.power.area3 = 20;
    tfPlayer.data.gaiaformers = 1;
    tfMars.clearAvailableCommands();
    const tfSet = buildCommittedTurnMacros(tfMars, { conversionIntegration: false });
    const tfMacros = tfSet.macros.filter(
      (macro) => macro.moveFragments[0] === `${Command.SpaceshipAction} ${Spaceship.TFMars} power`
    );
    expect(tfMacros.length).to.be.greaterThan(0);
    expect(
      tfMacros.every((macro) => macro.decisions.some((decision) => decision.command === Command.GaiaFormTransdim))
    ).to.equal(true);
    for (const macro of tfMacros.slice(0, 3)) {
      applyMacroHostStyle(tfMars, macro);
    }
  });
});
