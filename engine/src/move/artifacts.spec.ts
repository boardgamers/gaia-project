import { expect } from "chai";
import "mocha";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import {
  ArtifactToken,
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Resource,
  Spaceship,
  SubPhase,
} from "../enums";
import { GaiaHex } from "../gaia-hex";
import { classifySectorId, LostFleetSectorType } from "../lost-fleet-map";
import { Power } from "../player-data";
import { moveChooseArtifactToken, moveExamineArtifact } from "./artifacts";

function createLostFleetRoundMoveEngine(
  nbPlayers: number,
  factions: Faction[] = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits]
) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-artifacts-${nbPlayers}`], { lostFleet: true });

  engine.players.forEach((pl, index) => {
    pl.faction = factions[index];
    pl.loadFaction(null, engine.expansions);
    pl.data.victoryPoints = 30;
    pl.data.qics = 10;
    pl.data.credits = 20;
    pl.data.knowledge = 10;
    pl.data.ores = 10;
    pl.data.power = new Power(4, 4, 4, 0);
  });

  engine.phase = Phase.RoundMove;
  engine.round = 1;
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.currentPlayer = PlayerEnum.Player1;

  return engine;
}

function availableExamineArtifactCommand(
  engine: Engine,
  player: PlayerEnum
): AvailableCommand<Command.ExamineArtifact> | undefined {
  engine.clearAvailableCommands();
  return engine.findAvailableCommand(player, Command.ExamineArtifact);
}

function availableArtifactTokenCommand(
  engine: Engine,
  player: PlayerEnum
): AvailableCommand<Command.ChooseArtifactToken> | undefined {
  engine.generateAvailableCommands(SubPhase.ChooseArtifactToken);
  return engine.findAvailableCommand(player, Command.ChooseArtifactToken);
}

/** Occupies `count` unowned planets of distinct types as Mines for `player`, bypassing normal building rules. */
function occupyPlanetsOfDistinctTypes(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
  const pl = engine.player(player);
  const seenTypes = new Set<Planet>();
  const hexes: GaiaHex[] = [];

  for (const hex of engine.map.grid.values()) {
    if (hexes.length >= count) {
      break;
    }
    if (!hex.hasPlanet() || hex.data.spaceship !== undefined || hex.occupied() || seenTypes.has(hex.data.planet)) {
      continue;
    }
    seenTypes.add(hex.data.planet);
    hexes.push(hex);
  }

  expect(hexes, `need ${count} planets of distinct types`).to.have.length(count);

  for (const hex of hexes) {
    hex.data.player = player;
    hex.data.building = Building.Mine;
    pl.data.occupied.push(hex);
  }
  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return hexes;
}

/** Occupies one Mine in each of `count` distinct Deep Space sectors for `player`, bypassing normal building rules. */
function occupyDistinctDeepSpaceSectors(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
  const pl = engine.player(player);
  const seenSectors = new Set<string>();
  const hexes: GaiaHex[] = [];

  for (const hex of engine.map.grid.values()) {
    if (hexes.length >= count) {
      break;
    }
    if (classifySectorId(hex.data.sector) !== LostFleetSectorType.DeepSpace) {
      continue;
    }
    if (!hex.hasPlanet() || hex.data.spaceship !== undefined || hex.occupied()) {
      continue;
    }
    const sectorKey = hex.data.sector.replace(/_\d+$/, "");
    if (seenSectors.has(sectorKey)) {
      continue;
    }
    seenSectors.add(sectorKey);
    hexes.push(hex);
  }

  expect(hexes, `need ${count} distinct Deep Space sectors`).to.have.length(count);

  for (const hex of hexes) {
    hex.data.player = player;
    hex.data.building = Building.Mine;
    pl.data.occupied.push(hex);
  }
  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return hexes;
}

describe("Twilight's Examine Artifact action (RULES_CLARIFICATIONS.md §G6)", () => {
  it("should not be offered before Twilight has been explored", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    engine.tiles.artifacts = [ArtifactToken.Credit];

    expect(availableExamineArtifactCommand(engine, PlayerEnum.Player1)).to.equal(undefined);
  });

  it("should not be offered once all Artifact tokens have been claimed", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    engine.player(PlayerEnum.Player1).data.explorationShips[Spaceship.Twilight] = 1;
    engine.tiles.artifacts = [];

    expect(availableExamineArtifactCommand(engine, PlayerEnum.Player1)).to.equal(undefined);
  });

  it("should not be offered if the player cannot discard 6 power", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Twilight] = 1;
    player.data.power = new Power(2, 2, 1, 0); // only 5 discardable tokens
    engine.tiles.artifacts = [ArtifactToken.Credit];

    expect(availableExamineArtifactCommand(engine, PlayerEnum.Player1)).to.equal(undefined);
  });

  it("should cost 6 power and let the player claim one of the available tokens", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Twilight] = 1;
    engine.tiles.artifacts = [ArtifactToken.Credit, ArtifactToken.Power];

    const command = availableExamineArtifactCommand(engine, PlayerEnum.Player1);
    expect(command).to.not.equal(undefined);
    expect(command.data.cost).to.equal("6t");

    const beforeDiscardable = player.data.discardablePowerTokens();
    const beforeCredits = player.data.credits;
    const beforeOres = player.data.ores;

    engine.turnMoves = [`chooseArtifactToken ${ArtifactToken.Credit}`];
    moveExamineArtifact(engine, command, PlayerEnum.Player1);

    expect(player.data.discardablePowerTokens()).to.equal(beforeDiscardable - 6);
    expect(player.data.credits).to.equal(beforeCredits + 3);
    expect(player.data.ores).to.equal(beforeOres + 3);
    expect(engine.tiles.artifacts).to.deep.equal([ArtifactToken.Power]);
  });
});

describe("Artifact token effects (RULES_CLARIFICATIONS.md §G6)", () => {
  it("should expose every remaining Artifact token as a choosable option", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    engine.tiles.artifacts = [ArtifactToken.Credit, ArtifactToken.Power, ArtifactToken.Federation];

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    expect(command.data.tokens).to.deep.equal([ArtifactToken.Credit, ArtifactToken.Power, ArtifactToken.Federation]);
  });

  it("should still offer the Federation-shaped token, flagged as no-effect, when the player owns no Federation token (§G6/§C1, owner ruling 2026-07-03)", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    engine.tiles.artifacts = [ArtifactToken.Credit, ArtifactToken.Power, ArtifactToken.Federation];

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    expect(command.data.tokens).to.deep.equal([ArtifactToken.Credit, ArtifactToken.Power, ArtifactToken.Federation]);
    expect(command.data.noEffectTokens).to.deep.equal([ArtifactToken.Federation]);
  });

  it("should not flag the Federation-shaped token as no-effect once the player owns a Federation token", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.tiles.federations.push({ tile: Federation.Fed2, green: false });
    engine.tiles.artifacts = [ArtifactToken.Federation];

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    expect(command.data.noEffectTokens).to.equal(undefined);
  });

  it("should let the player claim the Federation-shaped token with no owned Federation token, and have no effect", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.Federation];

    const beforeVp = player.data.victoryPoints;
    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    engine.turnMoves = [];
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.Federation);

    expect(player.data.victoryPoints).to.equal(beforeVp);
    expect(engine.tiles.artifacts).to.have.length(0);
  });

  it("KnowledgeOre: grants +1 knowledge and +1 ore as ongoing income, not an immediate gain", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.KnowledgeOre];

    const beforeKnowledge = player.data.knowledge;
    const beforeOres = player.data.ores;
    const beforeKnowledgeIncome = player.resourceIncome(Resource.Knowledge);
    const beforeOreIncome = player.resourceIncome(Resource.Ore);

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.KnowledgeOre);

    expect(player.data.knowledge).to.equal(beforeKnowledge);
    expect(player.data.ores).to.equal(beforeOres);
    expect(player.resourceIncome(Resource.Knowledge)).to.equal(beforeKnowledgeIncome + 1);
    expect(player.resourceIncome(Resource.Ore)).to.equal(beforeOreIncome + 1);
    expect(engine.tiles.artifacts).to.have.length(0);
  });

  it("Credit: immediately grants 3 credits + 3 ore", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.Credit];

    const beforeCredits = player.data.credits;
    const beforeOres = player.data.ores;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.Credit);

    expect(player.data.credits).to.equal(beforeCredits + 3);
    expect(player.data.ores).to.equal(beforeOres + 3);
    expect(engine.tiles.artifacts).to.have.length(0);
  });

  it("KnowledgeQic: immediately grants 3 knowledge + 1 Q.I.C.", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.KnowledgeQic];

    const beforeKnowledge = player.data.knowledge;
    const beforeQic = player.data.qics;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.KnowledgeQic);

    expect(player.data.knowledge).to.equal(beforeKnowledge + 3);
    expect(player.data.qics).to.equal(beforeQic + 1);
  });

  it("CreditLarge: immediately grants 5 credits + 2 ore", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.CreditLarge];

    const beforeCredits = player.data.credits;
    const beforeOres = player.data.ores;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.CreditLarge);

    expect(player.data.credits).to.equal(beforeCredits + 5);
    expect(player.data.ores).to.equal(beforeOres + 2);
  });

  it("Power: grants 2 power into Area III as ongoing income, not an immediate gain", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.Power];

    const beforeArea3 = player.data.power.area3;
    const beforeArea3Income = player.resourceIncome(Resource.GainTokenArea3);

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.Power);

    expect(player.data.power.area3).to.equal(beforeArea3);
    expect(player.resourceIncome(Resource.GainTokenArea3)).to.equal(beforeArea3Income + 2);
    expect(engine.tiles.artifacts).to.have.length(0);
  });

  it("Asteroid: immediately grants 7 VP and counts as colonizing an Asteroid", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.Asteroid];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.Asteroid);

    expect(player.data.victoryPoints).to.equal(beforeVp + 7);
    expect(player.data.artifactPlanetTypes).to.include(Planet.Asteroid);
  });

  it("Protoplanet: immediately grants 7 VP and counts as colonizing a Protoplanet", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    engine.tiles.artifacts = [ArtifactToken.Protoplanet];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.Protoplanet);

    expect(player.data.victoryPoints).to.equal(beforeVp + 7);
    expect(player.data.artifactPlanetTypes).to.include(Planet.Protoplanet);
  });

  it("ResearchLevel: immediately grants 3 VP per level reached in the Science research area", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.research[ResearchField.Science] = 3;
    engine.tiles.artifacts = [ArtifactToken.ResearchLevel];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.ResearchLevel);

    expect(player.data.victoryPoints).to.equal(beforeVp + 9);
  });

  it("ResearchTracks: immediately grants 3 VP per Research Area at level 3 or higher", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.research[ResearchField.Terraforming] = 3;
    player.data.research[ResearchField.Navigation] = 4;
    player.data.research[ResearchField.Economy] = 2; // below threshold, must not count
    engine.tiles.artifacts = [ArtifactToken.ResearchTracks];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.ResearchTracks);

    expect(player.data.victoryPoints).to.equal(beforeVp + 6); // 2 tracks at level 3+
  });

  it("Federation: lets the player re-score an owned Federation token", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.tiles.federations.push({ tile: Federation.Fed2, green: false });
    engine.tiles.artifacts = [ArtifactToken.Federation];

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    // Fed2 rewards 8vp + 1 QIC when rescored
    engine.turnMoves = ["fedtile fed2"];
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.Federation);

    expect(player.data.victoryPoints).to.equal(beforeVp + 8);
    expect(player.data.qics).to.equal(beforeQic + 1);
    expect(engine.tiles.artifacts).to.have.length(0);
  });

  it("GaiaProject: immediately grants 3 VP per step up the Gaiaforming track", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.research[ResearchField.GaiaProject] = 2;
    engine.tiles.artifacts = [ArtifactToken.GaiaProject];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.GaiaProject);

    expect(player.data.victoryPoints).to.equal(beforeVp + 6);
  });

  it("PlanetTypes: immediately grants 3 VP + 1 VP per distinct planet type colonized", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 3);
    engine.tiles.artifacts = [ArtifactToken.PlanetTypes];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.PlanetTypes);

    expect(player.data.victoryPoints).to.equal(beforeVp + 3 + 3);
  });

  it("DeepSpace: immediately grants 3 VP per distinct colonized Deep Space sector", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    occupyDistinctDeepSpaceSectors(engine, PlayerEnum.Player1, 2);
    engine.tiles.artifacts = [ArtifactToken.DeepSpace];

    const beforeVp = player.data.victoryPoints;

    const command = availableArtifactTokenCommand(engine, PlayerEnum.Player1);
    moveChooseArtifactToken(engine, command, PlayerEnum.Player1, ArtifactToken.DeepSpace);

    expect(player.data.victoryPoints).to.equal(beforeVp + 6);
  });
});
