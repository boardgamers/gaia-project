import { expect } from "chai";
import "mocha";
import { possibleBoardActions } from "../../available/actions";
import { possibleBuildings } from "../../available/buildings";
import { possibleFederations, possibleFederationTiles } from "../../available/federations";
import { possibleResearchAreas } from "../../available/research";
import { possibleSpaceshipActions } from "../../available/spaceship-actions";
import { AvailableCommand, Offer, UPGRADE_RESEARCH_COST } from "../../available/types";
import Engine, { AuctionVariant } from "../../engine";
import {
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Player,
  ResearchField,
  Resource,
  Spaceship,
  SubPhase,
  TechTilePos,
} from "../../enums";
import Event from "../../events";
import { CanonicalStateError } from "../canonical-state";
import { LOST_FLEET_CHALLENGE, challengeEngineOptions } from "../challenge";
import { AtomicDecisionCandidate } from "./types";
import { AtomicExpansionError, AtomicExpansionOptions, expandAtomicDecisions } from "./expand";

function hydrate(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove)?.faction ?? `p${engine.playerToMove + 1}`;
}

function applyCandidate(source: Engine, candidate: AtomicDecisionCandidate, priorMoveFragments: string[] = []): Engine {
  const clone = hydrate(source);
  clone.move(`${actorPrefix(clone)} ${priorMoveFragments.concat(candidate.moveFragment).join(". ")}`);
  return clone;
}

function challengeSetupEngine(): Engine {
  return new Engine(LOST_FLEET_CHALLENGE.scriptedPrefix, challengeEngineOptions());
}

function lockedRoundOneEngine(): Engine {
  const engine = challengeSetupEngine();
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    guard -= 1;
    expect(guard, "locked setup must terminate").to.be.greaterThan(0);
  }
  expect(engine.phase).to.equal(Phase.RoundMove);
  expect(engine.round).to.equal(1);
  return engine;
}

function decisionEngine(source: Engine, options: AtomicExpansionOptions = {}): Engine {
  const engine = hydrate(source);
  const prior = options.priorMoveFragments ?? [];
  if (prior.length > 0) {
    engine.move(`${actorPrefix(engine)} ${prior.join(". ")}`);
  }
  engine.generateAvailableCommandsIfNeeded();
  return engine;
}

function expectedCount(command: AvailableCommand): number {
  switch (command.name) {
    case Command.Action:
      return command.data.poweracts.length;
    case Command.BrainStone:
      return command.data.choices.length;
    case Command.Build:
    case Command.PISwap:
      return command.data.buildings.length;
    case Command.BurnPower:
    case Command.ChooseFaction:
    case Command.ChooseIncome:
      return command.data.length;
    case Command.ChargePower:
      return command.data.offers.length;
    case Command.ChooseArtifactToken:
      return command.data.tokens.length;
    case Command.ChooseCoverTechTile:
    case Command.ChooseTechTile:
    case Command.ChooseTinkeringTile:
    case Command.ChooseFederationTile:
      return command.data.tiles.length;
    case Command.ChooseRoundBooster:
      return command.data.boosters.length;
    case Command.Decline:
    case Command.EndTurn:
    case Command.ExamineArtifact:
      return 1;
    case Command.Explore:
      return command.data.ships.length;
    case Command.FormFederation:
      return command.data.federations.length * command.data.tiles.length;
    case Command.GaiaFormTransdim:
    case Command.PlaceLostPlanet:
    case Command.PlacePowerRing:
      return command.data.spaces.length;
    case Command.Pass:
      return Math.max(command.data.boosters.length, 1);
    case Command.Special:
      return command.data.specialacts.length;
    case Command.Spend:
      return command.data.acts.reduce(
        (count, action) => count + (action.range && action.range.length > 0 ? new Set(action.range).size : 1),
        0
      );
    case Command.SpaceshipAction:
      return command.data.actions.length;
    case Command.UpgradeResearch:
      return command.data.tracks.length;
    default:
      throw new Error(`No expected-count arm for ${command.name}`);
  }
}

function exerciseDecision(
  source: Engine,
  seen: Set<Command>,
  options: AtomicExpansionOptions = {}
): AtomicDecisionCandidate[] {
  const decision = decisionEngine(source, options);
  const expansion = expandAtomicDecisions(source, options);

  for (const command of decision.availableCommands) {
    seen.add(command.name);
    expect(
      expansion.candidates.filter(
        (candidate) => candidate.command === command.name && candidate.actor === command.player
      ).length,
      `candidate count for ${command.name}`
    ).to.equal(expectedCount(command));
  }

  const keys = expansion.candidates.map((candidate) => candidate.key);
  expect(new Set(keys).size).to.equal(keys.length);
  expect(keys).to.deep.equal([...keys].sort());

  for (const candidate of expansion.candidates) {
    const expectedSubphase =
      options.subphase !== undefined ? options.subphase : decision.phase === Phase.RoundMove ? decision.subPhase : null;
    expect(candidate.key).to.match(/^atomic-v1:[0-9a-f]{64}$/);
    expect(candidate.actor).to.equal(decision.playerToMove);
    expect(candidate.phase).to.equal(decision.phase);
    expect(candidate.subphase).to.equal(expectedSubphase);
    expect(candidate.moveFragment).to.be.a("string").and.not.equal("");
    expect(() => applyCandidate(source, candidate, options.priorMoveFragments)).not.to.throw();
  }
  return expansion.candidates;
}

function richBuildingEngine(): Engine {
  const engine = lockedRoundOneEngine();
  const player = engine.player(Player.Player1);
  const hex = player.data.occupied[0];
  hex.data.building = Building.TradingStation;
  player.data.buildings[Building.Mine] -= 1;
  player.data.buildings[Building.TradingStation] = 1;
  player.data.ores = 20;
  player.data.credits = 30;
  player.data.knowledge = 20;
  player.data.qics = 20;
  player.data.power.area3 = 20;
  player.federationCache = null;
  engine.availableCommands = possibleBuildings(engine, Player.Player1);
  return engine;
}

function federationEngine(includeTwilight = false): Engine {
  const engine = lockedRoundOneEngine();
  const player = engine.player(Player.Player1);
  const structures = [Building.PlanetaryInstitute, Building.Academy1, Building.Academy2];
  player.data.occupied.forEach((hex, index) => {
    hex.data.building = structures[index];
  });
  player.data.buildings[Building.Mine] = 0;
  player.data.buildings[Building.PlanetaryInstitute] = 1;
  player.data.buildings[Building.Academy1] = 1;
  player.data.buildings[Building.Academy2] = 1;
  player.data.power.area1 = 20;
  player.data.power.area3 = 20;
  player.data.ores = 20;
  player.data.qics = 20;
  if (includeTwilight) {
    player.data.explorationShips[Spaceship.Twilight] = 1;
  }
  player.federationCache = null;
  engine.availableCommands = possibleFederations(engine, Player.Player1);
  return engine;
}

describe("Phase 1.2 typed atomic decision expansion", () => {
  it("covers the Phase 0 challenge state and applies every setup candidate", () => {
    const engine = challengeSetupEngine();
    const expansion = expandAtomicDecisions(engine);
    const command = engine.generateAvailableCommandsIfNeeded()[0];

    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(command.name).to.equal(Command.Build);
    expect(expansion.candidates).to.have.length(command.data.buildings.length);
    expect(expansion.candidates.every((candidate) => candidate.command === Command.Build)).to.equal(true);
    expect(expansion.candidates.every((candidate) => candidate.subphase === null)).to.equal(true);
    for (const candidate of expansion.candidates) {
      expect(() => applyCandidate(engine, candidate)).not.to.throw();
    }
  });

  it("expands each data element and required cross-product exactly once", () => {
    const round = lockedRoundOneEngine();
    const seen = new Set<Command>();
    exerciseDecision(round, seen);

    const federation = federationEngine();
    const command = federation.availableCommands[0];
    const candidates = exerciseDecision(federation, seen);
    expect(candidates).to.have.length(command.data.federations.length * command.data.tiles.length);
    expect(candidates.every((candidate) => candidate.command === Command.FormFederation)).to.equal(true);

    const spend = round
      .generateAvailableCommandsIfNeeded()
      .find((entry) => entry.name === Command.Spend) as AvailableCommand<Command.Spend>;
    const ranged = spend.data.acts.filter((action) => action.range && action.range.length > 1);
    expect(ranged.length, "locked Xenos/Hadsch Halla state must exercise ranged free actions").to.be.greaterThan(0);
  });

  it("keeps keys stable across constructor replay, slowMotion, and JSON hydration", () => {
    const source = lockedRoundOneEngine();
    const expected = expandAtomicDecisions(source).candidates.map((candidate) => candidate.key);
    const constructorReplay = new Engine(source.moveHistory, challengeEngineOptions(), source.version);
    const slowMotion = Engine.slowMotion(source.moveHistory, challengeEngineOptions(), source.version);
    const hydration = hydrate(source);

    expect(expandAtomicDecisions(constructorReplay).candidates.map((candidate) => candidate.key)).to.deep.equal(
      expected
    );
    expect(expandAtomicDecisions(slowMotion).candidates.map((candidate) => candidate.key)).to.deep.equal(expected);
    expect(expandAtomicDecisions(hydration).candidates.map((candidate) => candidate.key)).to.deep.equal(expected);
  });

  it("makes keys independent of command/data ordering and object identity", () => {
    const source = lockedRoundOneEngine();
    source.generateAvailableCommandsIfNeeded();
    const expected = expandAtomicDecisions(source).candidates.map((candidate) => candidate.key);
    const reordered = hydrate(source);

    for (const command of reordered.availableCommands) {
      switch (command.name) {
        case Command.Build:
          command.data.buildings.reverse();
          break;
        case Command.BurnPower:
        case Command.ChooseIncome:
        case Command.ChooseFaction:
          command.data.reverse();
          break;
        case Command.Explore:
          command.data.ships.reverse();
          break;
        case Command.Pass:
        case Command.ChooseRoundBooster:
          command.data.boosters.reverse();
          break;
        case Command.Special:
          command.data.specialacts.reverse();
          break;
        case Command.Spend:
          command.data.acts.reverse();
          command.data.acts.forEach((action) => action.range?.reverse());
          break;
        case Command.UpgradeResearch:
          command.data.tracks.reverse();
          break;
      }
    }
    reordered.availableCommands.reverse();

    expect(expandAtomicDecisions(reordered).candidates.map((candidate) => candidate.key)).to.deep.equal(expected);
    expect(reordered.availableCommands).not.to.equal(source.availableCommands);
  });

  it("supports supplied-prefix chained choices without accepting a transient source state", () => {
    const source = lockedRoundOneEngine();
    const opening = expandAtomicDecisions(source).candidates.find((candidate) => candidate.command === Command.Spend);
    const options = { priorMoveFragments: [opening.moveFragment], subphase: SubPhase.BeforeMove };
    const chained = exerciseDecision(source, new Set<Command>(), options);

    expect(chained.length).to.be.greaterThan(0);
    expect(source.newTurn).to.equal(true);
    expect(source.pendingMove).to.equal("");
  });

  it("covers locked setup, income/leech, normal actions, Lost Fleet actions, and chained choices", () => {
    const seen = new Set<Command>();

    const factionState = new Engine([`init 2 ${LOST_FLEET_CHALLENGE.seed}`], challengeEngineOptions());
    exerciseDecision(factionState, seen);

    const setup = challengeSetupEngine();
    while (setup.phase === Phase.SetupBuilding || setup.phase === Phase.SetupBooster) {
      const candidates = exerciseDecision(setup, seen);
      setup.move(`${actorPrefix(setup)} ${candidates[0].moveFragment}`);
    }

    const round = lockedRoundOneEngine();
    const roundCandidates = exerciseDecision(round, seen);
    const main = roundCandidates.find(
      (candidate) => ![Command.Spend, Command.BurnPower, Command.Pass].includes(candidate.command)
    );
    exerciseDecision(round, seen, {
      priorMoveFragments: [main.moveFragment],
      subphase: SubPhase.AfterMove,
    });

    const income = lockedRoundOneEngine();
    income.phase = Phase.RoundIncome;
    income.currentPlayer = Player.Player1;
    income.tempTurnOrder = [Player.Player2];
    income.player(Player.Player1).loadEvents(Event.parse(["+1t", "+2pw"], Command.ChooseIncome));
    income.clearAvailableCommands();
    exerciseDecision(income, seen);

    // The locked Xenos/Hadsch Halla pairing has no Gaia-phase conversion prompt. Exercise the
    // same standard-flow Spend/Decline command shapes on a committed Terrans-style Gaia state so
    // Phase 1.2 cannot accidentally treat RoundGaia as an unfamiliar phase.
    const gaia = lockedRoundOneEngine();
    const gaiaPlayer = gaia.player(Player.Player1);
    gaiaPlayer.faction = Faction.Terrans;
    gaiaPlayer.data.buildings[Building.PlanetaryInstitute] = 1;
    gaiaPlayer.data.occupied[0].data.building = Building.PlanetaryInstitute;
    gaiaPlayer.data.power.gaia = 8;
    gaia.phase = Phase.RoundGaia;
    gaia.currentPlayer = Player.Player1;
    gaia.tempTurnOrder = [Player.Player2];
    gaia.clearAvailableCommands();
    exerciseDecision(gaia, seen);

    const leech = lockedRoundOneEngine();
    leech.phase = Phase.RoundLeech;
    leech.tempCurrentPlayer = Player.Player2;
    leech.tempTurnOrder = [];
    leech.player(Player.Player2).data.leechPossible = 2;
    leech.clearAvailableCommands();
    exerciseDecision(leech, seen);

    const rich = lockedRoundOneEngine();
    rich.player(Player.Player1).data.power.area3 = 20;
    rich.availableCommands = possibleBoardActions(rich.boardActions, rich.player(Player.Player1), rich.replay);
    exerciseDecision(rich, seen);

    const artifacts = lockedRoundOneEngine();
    artifacts.player(Player.Player1).data.explorationShips[Spaceship.Twilight] = 1;
    artifacts.player(Player.Player1).data.qics = 20;
    artifacts.clearAvailableCommands();
    const examine = exerciseDecision(artifacts, seen).find(
      (candidate) => candidate.command === Command.ExamineArtifact
    );
    exerciseDecision(artifacts, seen, {
      priorMoveFragments: [examine.moveFragment],
      subphase: SubPhase.ChooseArtifactToken,
    });

    const tfMars = lockedRoundOneEngine();
    const tfMarsPlayer = tfMars.player(Player.Player1);
    tfMarsPlayer.data.explorationShips[Spaceship.TFMars] = 1;
    tfMarsPlayer.data.power.area3 = 20;
    tfMarsPlayer.data.gaiaformers = 1;
    tfMarsPlayer.data.qics = 20;
    tfMars.availableCommands = possibleSpaceshipActions(tfMars, Player.Player1);
    const tfMarsPower = exerciseDecision(tfMars, seen).find(
      (candidate) => candidate.moveFragment === `${Command.SpaceshipAction} ${Spaceship.TFMars} power`
    );
    exerciseDecision(tfMars, seen, {
      priorMoveFragments: [tfMarsPower.moveFragment],
      subphase: SubPhase.InstantGaiaforming,
    });

    const buildings = richBuildingEngine();
    const lab = exerciseDecision(buildings, seen).find(
      (candidate) => candidate.command === Command.Build && candidate.target.building === Building.ResearchLab
    );
    const tech = exerciseDecision(buildings, seen, {
      priorMoveFragments: [lab.moveFragment],
      subphase: SubPhase.ChooseTechTile,
    }).find((candidate) => candidate.command === Command.ChooseTechTile);
    exerciseDecision(buildings, seen, {
      priorMoveFragments: [lab.moveFragment, tech.moveFragment],
      subphase: SubPhase.UpgradeResearch,
    });

    const advanced = richBuildingEngine();
    const advancedPlayer = advanced.player(Player.Player1);
    advancedPlayer.data.research[ResearchField.Terraforming] = 4;
    advancedPlayer.data.tiles.federations.push({ tile: Federation.Fed2, green: true });
    const standardPosition = TechTilePos.Free1;
    advancedPlayer.data.tiles.techs.push({
      tile: advanced.tiles.techs[standardPosition].tile,
      pos: standardPosition,
      enabled: true,
    });
    advanced.availableCommands = possibleBuildings(advanced, Player.Player1);
    const advancedLab = expandAtomicDecisions(advanced).candidates.find(
      (candidate) => candidate.command === Command.Build && candidate.target.building === Building.ResearchLab
    );
    const advancedTile = exerciseDecision(advanced, seen, {
      priorMoveFragments: [advancedLab.moveFragment],
      subphase: SubPhase.ChooseTechTile,
    }).find(
      (candidate) =>
        candidate.command === Command.ChooseTechTile && String(candidate.target.position).startsWith("adv-")
    );
    exerciseDecision(advanced, seen, {
      priorMoveFragments: [advancedLab.moveFragment, advancedTile.moveFragment],
      subphase: SubPhase.CoverTechTile,
    });

    const lostPlanet = lockedRoundOneEngine();
    const lostPlanetPlayer = lostPlanet.player(Player.Player1);
    lostPlanetPlayer.data.research[ResearchField.Navigation] = 4;
    lostPlanetPlayer.data.tiles.federations.push({ tile: Federation.Fed2, green: true });
    lostPlanetPlayer.data.knowledge = 20;
    lostPlanet.availableCommands = possibleResearchAreas(lostPlanet, Player.Player1, UPGRADE_RESEARCH_COST);
    const navigation = exerciseDecision(lostPlanet, seen).find(
      (candidate) =>
        candidate.command === Command.UpgradeResearch && candidate.target.field === ResearchField.Navigation
    );
    exerciseDecision(lostPlanet, seen, {
      priorMoveFragments: [navigation.moveFragment],
      subphase: SubPhase.PlaceLostPlanet,
    });

    const federation = federationEngine(true);
    const federationCandidates = exerciseDecision(federation, seen);
    const shipFederation = federationCandidates.find(
      (candidate) =>
        candidate.command === Command.FormFederation &&
        candidate.target.federation === federation.tiles.spaceshipFederations[Spaceship.Twilight]
    );
    exerciseDecision(federation, seen, {
      priorMoveFragments: [shipFederation.moveFragment],
      subphase: SubPhase.FederationTokenBuildMine,
    });

    const rescore = lockedRoundOneEngine();
    rescore.player(Player.Player1).data.tiles.federations.push({ tile: Federation.Fed2, green: true });
    rescore.availableCommands = possibleFederationTiles(rescore, Player.Player1, "player");
    exerciseDecision(rescore, seen);

    const required = [
      Command.Action,
      Command.Build,
      Command.BurnPower,
      Command.ChargePower,
      Command.ChooseArtifactToken,
      Command.ChooseCoverTechTile,
      Command.ChooseFaction,
      Command.ChooseFederationTile,
      Command.ChooseIncome,
      Command.ChooseRoundBooster,
      Command.ChooseTechTile,
      Command.Decline,
      Command.EndTurn,
      Command.ExamineArtifact,
      Command.Explore,
      Command.FormFederation,
      Command.GaiaFormTransdim,
      Command.Pass,
      Command.PlaceLostPlanet,
      Command.Special,
      Command.Spend,
      Command.SpaceshipAction,
      Command.UpgradeResearch,
    ];
    expect([...seen].sort()).to.include.members(required.sort());
  });

  it("projects identifiers, resources, range/terraform/satellite metadata, warnings, and move fragments", () => {
    const round = lockedRoundOneEngine();
    const explore = expandAtomicDecisions(round).candidates.find((candidate) => candidate.command === Command.Explore);
    expect(explore.target.ship).to.be.oneOf([Spaceship.Twilight, Spaceship.TFMars, Spaceship.Eclipse]);
    expect(explore.target.range.distance).to.be.a("number");
    expect(explore.resources.cost.find((amount) => amount.resource === Resource.VictoryPoint)?.amount).to.equal(5);
    expect(explore.moveFragment).to.equal(`${Command.Explore} ${explore.target.ship}`);

    const build = expandAtomicDecisions(round).candidates.find((candidate) => candidate.command === Command.Build);
    expect(build.target.building).to.be.a("string");
    expect(build.target.terraform.steps).to.be.a("number");
    expect(build.target.range.temporaryRange).to.be.a("number");

    const federation = expandAtomicDecisions(federationEngine()).candidates.find(
      (candidate) => candidate.command === Command.FormFederation
    );
    expect(federation.target.federation).to.be.a("string");
    expect(federation.target.satellites.newSatelliteHexes.length).to.be.greaterThan(0);
    expect(federation.resources.cost.find((amount) => amount.resource === Resource.GainToken)?.amount).to.equal(
      federation.target.satellites.newSatelliteHexes.length
    );
  });

  it("reports rather than silently merging documented semantic duplicates", () => {
    const exact = challengeSetupEngine();
    const build = exact.generateAvailableCommandsIfNeeded()[0] as AvailableCommand<Command.Build>;
    build.data.buildings.push(JSON.parse(JSON.stringify(build.data.buildings[0])));
    const exactExpansion = expandAtomicDecisions(exact);
    expect(exactExpansion.deduplications).to.deep.include({
      key: exactExpansion.candidates.find(
        (candidate) => candidate.moveFragment === `build m ${build.data.buildings[0].coordinates}`
      ).key,
      command: Command.Build,
      occurrences: 2,
      reason: "identical-semantic-option",
    });

    const decline = lockedRoundOneEngine();
    decline.availableCommands = [
      {
        name: Command.Decline,
        player: Player.Player1,
        data: { offers: [new Offer("1pw", ""), new Offer("2pw", "1vp")] },
      },
    ];
    const declineExpansion = expandAtomicDecisions(decline);
    expect(declineExpansion.candidates).to.have.length(1);
    expect(declineExpansion.deduplications).to.deep.equal([
      {
        key: declineExpansion.candidates[0].key,
        command: Command.Decline,
        occurrences: 2,
        reason: "decline-ignores-offer",
      },
    ]);
  });

  it("rejects incomplete states and every non-standard faction-picking variant", () => {
    const incomplete = lockedRoundOneEngine();
    const spend = expandAtomicDecisions(incomplete).candidates.find((candidate) => candidate.command === Command.Spend);
    incomplete.move(`${actorPrefix(incomplete)} ${spend.moveFragment}`);
    expect(incomplete.newTurn).to.equal(false);
    expect(() => expandAtomicDecisions(incomplete)).to.throw(CanonicalStateError, /engine\.newTurn === true/);

    const variants = [
      { auction: AuctionVariant.ChooseBid },
      { auction: AuctionVariant.Silent },
      { banPhase: true },
      { randomFactions: true },
    ];
    for (const variant of variants) {
      const engine = new Engine(
        [`init 2 unsupported-phase-1-2-${Object.keys(variant)[0]}`],
        Object.assign(challengeEngineOptions(), variant)
      );
      expect(() => expandAtomicDecisions(engine), JSON.stringify(variant)).to.throw(CanonicalStateError);
    }

    const nonStandardBoardVariant = new Engine(
      ["init 2 unsupported-phase-1-2-faction-board-variant"],
      Object.assign(challengeEngineOptions(), { factionVariant: "more-balanced" as const })
    );
    expect(() => expandAtomicDecisions(nonStandardBoardVariant))
      .to.throw(AtomicExpansionError)
      .with.property("code", "unsupported-state");
  });

  it("rejects undo signals, custom federation fallbacks, and out-of-scope command families", () => {
    const deadEnd = lockedRoundOneEngine();
    deadEnd.availableCommands = [{ name: Command.DeadEnd, player: Player.Player1, data: SubPhase.BuildMine }];
    expect(() => expandAtomicDecisions(deadEnd))
      .to.throw(AtomicExpansionError)
      .with.property("code", "unsupported-command");

    const customFederation = lockedRoundOneEngine();
    customFederation.availableCommands = [
      {
        name: Command.FormFederation,
        player: Player.Player1,
        data: { tiles: [Federation.Fed2], federations: [], claimableFederations: [] },
      },
    ];
    expect(() => expandAtomicDecisions(customFederation))
      .to.throw(AtomicExpansionError)
      .with.property("code", "empty-command-data");

    const frontiers = lockedRoundOneEngine();
    frontiers.availableCommands = [{ name: Command.MoveShip, player: Player.Player1, data: [] }];
    expect(() => expandAtomicDecisions(frontiers))
      .to.throw(AtomicExpansionError)
      .with.property("code", "unsupported-command");
  });
});
