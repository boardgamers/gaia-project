import { expect } from "chai";
import "mocha";
import { AvailableCommand } from "./available/types";
import { qicForDistance, terraformingCost } from "./cost";
import Engine from "./engine";
import { spaceshipHex } from "./exploration";
import {
  Building,
  Command,
  Condition,
  Faction,
  Federation,
  Phase,
  Planet,
  Player as PlayerEnum,
  PowerArea,
  ResearchField,
  Resource,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  SubPhase,
} from "./enums";
import { GaiaHex } from "./gaia-hex";
import { possibleSpaceshipTechTileBuildMine } from "./available/federations";
import { moveExplore } from "./move/exploration";
import { moveFormFederation } from "./move/federation";
import { moveChooseCoverTechTile, moveChooseTechTile } from "./move/research";
import { terraformingStepsRequired } from "./planets";
import { Power } from "./player-data";
import Reward from "./reward";

function createLostFleetRoundMoveEngine(
  nbPlayers: number,
  factions: Faction[] = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits]
) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-exploration-${nbPlayers}`], { lostFleet: true });

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

function occupyNearestPlanet(engine: Engine, player: PlayerEnum, ship: Spaceship): GaiaHex {
  const pl = engine.player(player);
  const shipTile = spaceshipHex(engine.map, ship);
  const candidate = [...engine.map.grid.values()]
    .filter((hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied())
    .sort((a, b) => engine.map.distance(a, shipTile) - engine.map.distance(b, shipTile))[0];

  expect(candidate, `need a colonizable planet near ${ship}`).to.not.equal(undefined);

  candidate.data.player = player;
  candidate.data.building = Building.Mine;
  pl.data.occupied.push(candidate);
  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return candidate;
}

function availableExploreCommand(engine: Engine): AvailableCommand<Command.Explore> | undefined {
  engine.clearAvailableCommands();
  return engine.findAvailableCommand(PlayerEnum.Player1, Command.Explore);
}

function occupyConnectedPlanets(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
  const pl = engine.player(player);
  const start = [...engine.map.grid.values()].find((hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied());

  expect(start, "need a starting planet for federation setup").to.not.equal(undefined);

  const queue: GaiaHex[] = [start];
  const visited = new Set<GaiaHex>();
  const cluster: GaiaHex[] = [];

  while (queue.length > 0 && cluster.length < count) {
    const hex = queue.shift();
    if (visited.has(hex)) {
      continue;
    }

    visited.add(hex);

    if (hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()) {
      cluster.push(hex);
      for (const neighbor of engine.map.grid.neighbours(hex)) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  expect(cluster, `need ${count} connected planets for federation setup`).to.have.length(count);

  for (const hex of cluster) {
    hex.data.player = player;
    hex.data.building = Building.Mine;
    pl.data.occupied.push(hex);
  }

  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return cluster;
}

/** Cheapest unoccupied, non-Transdim/Asteroid/Gaia hex that needs both QIC range extension and terraforming ore. */
function cheapestHexNeedingRangeAndTerraforming(
  engine: Engine,
  player: PlayerEnum,
  faction: Faction
): { hex: GaiaHex; qic: number; steps: number } | undefined {
  const pl = engine.player(player);
  let best: { hex: GaiaHex; qic: number; steps: number } | undefined;

  for (const hex of engine.map.grid.values()) {
    if (!hex.hasPlanet() || hex.occupied()) {
      continue;
    }
    if (hex.data.planet === Planet.Transdim || hex.data.planet === Planet.Asteroid || hex.data.planet === Planet.Gaia) {
      continue;
    }
    const steps = terraformingStepsRequired(faction, hex.data.planet);
    if (steps < 1) {
      continue;
    }
    const qic = qicForDistance(engine.map, hex, pl, engine.replay)?.amount ?? 0;
    if (qic < 1) {
      continue;
    }
    if (!best || qic < best.qic) {
      best = { hex, qic, steps };
    }
  }

  return best;
}

describe("Lost Fleet exploration", () => {
  it("should offer Explore targets for the ships in play and exclude Rebellion in 2-player games", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    occupyNearestPlanet(engine, PlayerEnum.Player1, Spaceship.Twilight);

    const command = availableExploreCommand(engine);
    expect(command).to.not.equal(undefined);

    const ships = command.data.ships.map((entry) => entry.ship);
    expect(ships).to.have.members([Spaceship.Twilight, Spaceship.TFMars, Spaceship.Eclipse]);
    expect(ships).to.not.include(Spaceship.Rebellion);
    expect(command.data.ships.every((entry) => entry.slot === 1)).to.be.true;
  });

  it("should pay the Explore cost, take the lowest free slot, charge power, and survive serialization", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    occupyNearestPlanet(engine, PlayerEnum.Player1, Spaceship.Twilight);
    engine.player(PlayerEnum.Player2).data.explorationShips[Spaceship.Twilight] = 1;

    const player = engine.player(PlayerEnum.Player1);
    player.data.power = new Power(0, 2, 0, 0);

    const command = availableExploreCommand(engine);
    const twilight = command.data.ships.find((entry) => entry.ship === Spaceship.Twilight);

    expect(twilight).to.not.equal(undefined);

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;
    const qicCost = Reward.parse(twilight.cost).find((reward) => reward.type === Resource.Qic)?.count ?? 0;

    moveExplore(engine, command, PlayerEnum.Player1, Spaceship.Twilight);

    expect(player.data.explorationShips[Spaceship.Twilight]).to.equal(2);
    expect(player.data.victoryPoints).to.equal(beforeVp - 5);
    expect(player.data.qics).to.equal(beforeQic - qicCost);
    expect(player.data.power.area1).to.equal(0);
    expect(player.data.power.area2).to.equal(0);
    expect(player.data.power.area3).to.equal(2);

    const restored = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    expect(restored.player(PlayerEnum.Player1).data.explorationShips[Spaceship.Twilight]).to.equal(2);
  });

  it("should enforce the one-shuttle-per-ship rule and the 2-player shuttle limit", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    occupyNearestPlanet(engine, PlayerEnum.Player1, Spaceship.Twilight);

    let command = availableExploreCommand(engine);
    moveExplore(engine, command, PlayerEnum.Player1, Spaceship.Twilight);

    command = availableExploreCommand(engine);
    expect(command.data.ships.map((entry) => entry.ship)).to.not.include(Spaceship.Twilight);

    moveExplore(engine, command, PlayerEnum.Player1, command.data.ships[0].ship);

    expect(engine.player(PlayerEnum.Player1).data.exploredShipsCount()).to.equal(2);
    expect(availableExploreCommand(engine)).to.equal(undefined);
  });

  it("should apply the Taklons and Nevlas deploy adjustments", () => {
    const taklonsEngine = createLostFleetRoundMoveEngine(2, [Faction.Taklons, Faction.Terrans]);
    occupyNearestPlanet(taklonsEngine, PlayerEnum.Player1, Spaceship.Eclipse);

    const taklons = taklonsEngine.player(PlayerEnum.Player1);
    taklons.data.brainstone = PowerArea.Area2;
    taklons.data.power = new Power(0, 0, 0, 0);

    const taklonsCommand = availableExploreCommand(taklonsEngine);
    expect(taklonsCommand.data.ships[0].adjustments).to.include("brainstone -> gaia");

    moveExplore(taklonsEngine, taklonsCommand, PlayerEnum.Player1, taklonsCommand.data.ships[0].ship);

    expect(taklons.data.brainstone).to.equal(PowerArea.Gaia);

    const nevlasEngine = createLostFleetRoundMoveEngine(2, [Faction.Nevlas, Faction.Terrans]);
    occupyNearestPlanet(nevlasEngine, PlayerEnum.Player1, Spaceship.TFMars);

    const nevlas = nevlasEngine.player(PlayerEnum.Player1);
    nevlas.data.power = new Power(1, 0, 0, 0);

    const nevlasCommand = availableExploreCommand(nevlasEngine);
    const nevlasTarget = nevlasCommand.data.ships[0];

    expect(Reward.parse(nevlasTarget.cost).some((reward) => reward.type === Resource.GainToken)).to.be.true;

    moveExplore(nevlasEngine, nevlasCommand, PlayerEnum.Player1, nevlasTarget.ship);

    expect(nevlas.data.power.area1).to.equal(0);
    expect(nevlas.data.power.area2).to.equal(0);
    expect(nevlas.data.power.area3).to.equal(0);
  });

  it("should not offer Taklons an Explore action while the brainstone is already in Gaia, but should again next round", () => {
    const engine = createLostFleetRoundMoveEngine(2, [Faction.Taklons, Faction.Terrans]);
    occupyNearestPlanet(engine, PlayerEnum.Player1, Spaceship.Eclipse);

    const taklons = engine.player(PlayerEnum.Player1);
    taklons.data.brainstone = PowerArea.Gaia;

    expect(availableExploreCommand(engine)).to.equal(undefined);

    taklons.gaiaPhaseEnd();

    expect(taklons.data.brainstone).to.equal(PowerArea.Area1);
    expect(availableExploreCommand(engine)).to.not.equal(undefined);
  });

  it("should not offer Explore when Bal T'aks, Nevlas, or Itars cannot pay their faction-specific cost", () => {
    const baltaksEngine = createLostFleetRoundMoveEngine(2, [Faction.BalTaks, Faction.Terrans]);
    occupyNearestPlanet(baltaksEngine, PlayerEnum.Player1, Spaceship.Twilight);
    baltaksEngine.player(PlayerEnum.Player1).data.victoryPoints = 6;
    expect(availableExploreCommand(baltaksEngine)).to.equal(undefined);

    const nevlasEngine = createLostFleetRoundMoveEngine(2, [Faction.Nevlas, Faction.Terrans]);
    occupyNearestPlanet(nevlasEngine, PlayerEnum.Player1, Spaceship.TFMars);
    nevlasEngine.player(PlayerEnum.Player1).data.power = new Power(0, 0, 0, 0);
    expect(availableExploreCommand(nevlasEngine)).to.equal(undefined);

    const itarsEngine = createLostFleetRoundMoveEngine(2, [Faction.Itars, Faction.Terrans]);
    occupyNearestPlanet(itarsEngine, PlayerEnum.Player1, Spaceship.Eclipse);
    itarsEngine.player(PlayerEnum.Player1).data.power = new Power(0, 0, 0, 0);
    expect(availableExploreCommand(itarsEngine)).to.equal(undefined);
  });

  it("should offer an explored ship Standard Tech tile through the normal tech-pick flow", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    player.data.explorationShips[Spaceship.TFMars] = 1;
    engine.tiles.spaceshipTechs[Spaceship.TFMars] = { tile: SpaceshipTechTile.Resource, count: 1 };

    engine.generateAvailableCommands(SubPhase.ChooseTechTile);
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.ChooseTechTile);
    const shipTech = command.data.tiles.find((tile) => tile.pos === Spaceship.TFMars);
    const beforeGaia = player.data.research[ResearchField.GaiaProject];

    expect(shipTech).to.deep.equal({
      tile: SpaceshipTechTile.Resource,
      pos: Spaceship.TFMars,
    });

    engine.turnMoves = ["up gaia"];
    moveChooseTechTile(engine, command, PlayerEnum.Player1, Spaceship.TFMars);

    expect(engine.tiles.spaceshipTechs[Spaceship.TFMars]).to.equal(undefined);
    expect(player.data.research[ResearchField.GaiaProject]).to.equal(beforeGaia + 1);
    expect(player.data.tiles.techs.find((tile) => tile.pos === Spaceship.TFMars)).to.deep.include({
      tile: SpaceshipTechTile.Resource,
      pos: Spaceship.TFMars,
      enabled: true,
    });
  });

  it("should prompt a discounted Build a Mine action for the Terraform Standard Tech tile, before the tech-track bump", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    occupyNearestPlanet(engine, PlayerEnum.Player1, Spaceship.TFMars);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    engine.tiles.spaceshipTechs[Spaceship.TFMars] = { tile: SpaceshipTechTile.Terraform, count: 1 };

    engine.generateAvailableCommands(SubPhase.ChooseTechTile);
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.ChooseTechTile);

    // Confirm the discounted Build a Mine action is actually on offer (2 free terraforming steps,
    // ore still charged for anything beyond that) before wiring it into the queued turn moves below.
    const [buildCommand] = possibleSpaceshipTechTileBuildMine(engine, PlayerEnum.Player1);
    expect(buildCommand, "a discounted Build a Mine action should be offered").to.not.equal(undefined);
    const target = buildCommand.data.buildings[0];
    const targetSteps = terraformingStepsRequired(
      player.faction,
      engine.map.getS(target.coordinates).data.planet,
      player.data.lostFleetCost3Planets
    );
    const oreCost = Reward.parse(target.cost).find((r) => r.type === Resource.Ore)?.count ?? 0;
    expect(oreCost).to.equal(terraformingCost(player.data, Math.max(targetSteps - 2, 0), engine.replay).count);

    const beforeGaia = player.data.research[ResearchField.GaiaProject];
    const beforeMines = player.data.buildings[Building.Mine];

    engine.turnMoves = [`build m ${target.coordinates}`, "up gaia"];
    moveChooseTechTile(engine, command, PlayerEnum.Player1, Spaceship.TFMars);

    expect(player.data.buildings[Building.Mine]).to.equal(beforeMines + 1);
    expect(player.data.research[ResearchField.GaiaProject]).to.equal(beforeGaia + 1);
    expect(player.data.tiles.techs.find((tile) => tile.pos === Spaceship.TFMars)).to.deep.include({
      tile: SpaceshipTechTile.Terraform,
      pos: Spaceship.TFMars,
      enabled: true,
    });
  });

  it("should let an advanced tech cover a claimed ship Standard Tech tile", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    player.data.tiles.techs.push({
      tile: SpaceshipTechTile.Range,
      pos: Spaceship.Eclipse,
      enabled: true,
    });

    engine.generateAvailableCommands(SubPhase.CoverTechTile);
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.ChooseCoverTechTile);

    expect(command.data.tiles).to.have.length(1);
    expect(command.data.tiles[0]).to.deep.include({
      tile: SpaceshipTechTile.Range,
      pos: Spaceship.Eclipse,
    });

    moveChooseCoverTechTile(engine, command, PlayerEnum.Player1, Spaceship.Eclipse);

    expect(player.data.tiles.techs.find((tile) => tile.pos === Spaceship.Eclipse)?.enabled).to.be.false;
  });

  it("should offer an explored ship federation token as an additional federation choice", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    federationCluster[0].data.building = Building.ResearchLab;
    player.data.buildings[Building.Mine] = federationCluster.length - 1;
    player.data.buildings[Building.ResearchLab] = 1;
    player.data.explorationShips[Spaceship.Twilight] = 1;
    engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Credit;

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);
    const shipTile = spaceshipHex(engine.map, Spaceship.Twilight);

    expect(command.data.claimableFederations).to.deep.equal([
      { ship: Spaceship.Twilight, federation: SpaceshipFederation.Credit },
    ]);
    expect(command.data.tiles).to.include(command.data.claimableFederations[0].federation);
    expect(command.data.tiles.some((tile) => tile === command.data.tiles[0] && tile !== SpaceshipFederation.Credit)).to.be.true;
    expect(command.data.federations[0].hexes.split(",")).to.not.include(shipTile.toString());

    moveFormFederation(
      engine,
      command,
      PlayerEnum.Player1,
      command.data.federations[0].hexes,
      SpaceshipFederation.Credit
    );

    expect(engine.tiles.spaceshipFederations[Spaceship.Twilight]).to.equal(undefined);
    expect(player.data.spaceshipFederations.map((fed) => fed.tile)).to.deep.equal([SpaceshipFederation.Credit]);
    expect(player.eventConditionCount(Condition.Federation)).to.equal(1);
    expect(player.data.hasGreenFederation()).to.be.true;
  });

  it("should not auto-claim a ship federation token when the player chooses a normal pool token instead", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    federationCluster[0].data.building = Building.ResearchLab;
    player.data.buildings[Building.Mine] = federationCluster.length - 1;
    player.data.buildings[Building.ResearchLab] = 1;
    player.data.explorationShips[Spaceship.Twilight] = 1;
    engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Credit;

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);
    const poolTile = command.data.tiles.find((tile) => tile !== SpaceshipFederation.Credit) as Federation;

    expect(poolTile).to.not.equal(undefined);

    moveFormFederation(engine, command, PlayerEnum.Player1, command.data.federations[0].hexes, poolTile);

    expect(engine.tiles.spaceshipFederations[Spaceship.Twilight]).to.equal(SpaceshipFederation.Credit);
    expect(player.data.spaceshipFederations).to.deep.equal([]);
    expect(player.data.tiles.federations.map((fed) => fed.tile)).to.deep.equal([poolTile]);
  });

  it("should let the player choose among multiple explored ship federation tokens", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    federationCluster[0].data.building = Building.ResearchLab;
    player.data.buildings[Building.Mine] = federationCluster.length - 1;
    player.data.buildings[Building.ResearchLab] = 1;
    player.data.explorationShips[Spaceship.Twilight] = 1;
    player.data.explorationShips[Spaceship.Eclipse] = 1;
    engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Credit;
    engine.tiles.spaceshipFederations[Spaceship.Eclipse] = SpaceshipFederation.Knowledge;

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);

    expect(command.data.claimableFederations).to.deep.equal([
      { ship: Spaceship.Twilight, federation: SpaceshipFederation.Credit },
      { ship: Spaceship.Eclipse, federation: SpaceshipFederation.Knowledge },
    ]);
    expect(command.data.tiles).to.include(SpaceshipFederation.Credit);
    expect(command.data.tiles).to.include(SpaceshipFederation.Knowledge);

    moveFormFederation(engine, command, PlayerEnum.Player1, command.data.federations[0].hexes, SpaceshipFederation.Knowledge);

    expect(engine.tiles.spaceshipFederations[Spaceship.Twilight]).to.equal(SpaceshipFederation.Credit);
    expect(engine.tiles.spaceshipFederations[Spaceship.Eclipse]).to.equal(undefined);
    expect(player.data.spaceshipFederations.map((fed) => fed.tile)).to.deep.equal([SpaceshipFederation.Knowledge]);
  });

  it("should still allow forming a federation when only explored ship federation tokens are available", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    federationCluster[0].data.building = Building.ResearchLab;
    player.data.buildings[Building.Mine] = federationCluster.length - 1;
    player.data.buildings[Building.ResearchLab] = 1;
    player.data.explorationShips[Spaceship.Twilight] = 1;
    engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Credit;

    for (const tile of Federation.values(engine.expansions)) {
      engine.tiles.federations[tile] = 0;
    }

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);

    expect(command.data.tiles).to.deep.equal([SpaceshipFederation.Credit]);

    moveFormFederation(engine, command, PlayerEnum.Player1, command.data.federations[0].hexes, SpaceshipFederation.Credit);

    expect(player.data.spaceshipFederations.map((fed) => fed.tile)).to.deep.equal([SpaceshipFederation.Credit]);
  });

  it("should claim a Range Federation token and chain into a free Build a Mine action with unlimited range", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    federationCluster[0].data.building = Building.ResearchLab;
    player.data.buildings[Building.Mine] = federationCluster.length - 1;
    player.data.buildings[Building.ResearchLab] = 1;
    player.data.explorationShips[Spaceship.Eclipse] = 1;
    engine.tiles.spaceshipFederations[Spaceship.Eclipse] = SpaceshipFederation.Range;

    const target = cheapestHexNeedingRangeAndTerraforming(engine, PlayerEnum.Player1, Faction.Terrans);
    expect(target, "need a hex needing both QIC range extension and terraforming").to.not.equal(undefined);

    const beforeOre = player.data.ores;
    const beforeQic = player.data.qics;
    const beforeCredits = player.data.credits;
    const expectedOre = terraformingCost(player.data, target.steps, engine.replay).count;

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);

    engine.turnMoves = [`build m ${target.hex.toString()}`];
    moveFormFederation(engine, command, PlayerEnum.Player1, command.data.federations[0].hexes, SpaceshipFederation.Range);

    expect(engine.tiles.spaceshipFederations[Spaceship.Eclipse]).to.equal(undefined);
    expect(player.data.spaceshipFederations.map((fed) => fed.tile)).to.deep.equal([SpaceshipFederation.Range]);
    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(target.hex.data.player).to.equal(PlayerEnum.Player1);
    expect(player.data.qics, "Range waives range QIC entirely").to.equal(beforeQic);
    expect(player.data.credits, "the board build cost should be waived").to.equal(beforeCredits);
    expect(player.data.ores, "Range still charges the full, undiscounted terraforming ore").to.equal(beforeOre - expectedOre);
  });

  it("should claim a Terraform Federation token and chain into a free Build a Mine action with discounted terraforming", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);

    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    federationCluster[0].data.building = Building.ResearchLab;
    player.data.buildings[Building.Mine] = federationCluster.length - 1;
    player.data.buildings[Building.ResearchLab] = 1;
    player.data.explorationShips[Spaceship.TFMars] = 1;
    engine.tiles.spaceshipFederations[Spaceship.TFMars] = SpaceshipFederation.Terraform;

    const target = cheapestHexNeedingRangeAndTerraforming(engine, PlayerEnum.Player1, Faction.Terrans);
    expect(target, "need a hex needing both QIC range extension and terraforming").to.not.equal(undefined);

    const beforeOre = player.data.ores;
    const beforeQic = player.data.qics;
    const beforeCredits = player.data.credits;

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);

    engine.turnMoves = [`build m ${target.hex.toString()}`];
    moveFormFederation(engine, command, PlayerEnum.Player1, command.data.federations[0].hexes, SpaceshipFederation.Terraform);

    expect(engine.tiles.spaceshipFederations[Spaceship.TFMars]).to.equal(undefined);
    expect(player.data.spaceshipFederations.map((fed) => fed.tile)).to.deep.equal([SpaceshipFederation.Terraform]);
    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(target.hex.data.player).to.equal(PlayerEnum.Player1);
    expect(player.data.credits, "the board build cost should be waived").to.equal(beforeCredits);
    expect(player.data.qics, "Terraform still charges range QIC normally").to.equal(beforeQic - target.qic);
    expect(
      player.data.ores,
      "terraformingStepsRequired never exceeds 3, so Terraform's 3-step discount waives ore entirely"
    ).to.equal(beforeOre);
  });
});
