import { expect } from "chai";
import "mocha";
import { AvailableCommand } from "../available/types";
import { qicForDistance, terraformingCost } from "../cost";
import Engine from "../engine";
import {
  AdvTechTile,
  AdvTechTilePos,
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
  TechTile,
  TechTilePos,
} from "../enums";
import { GaiaHex } from "../gaia-hex";
import { Power } from "../player-data";
import { terraformingStepsRequired } from "../planets";
import { techTileEventWithSource } from "../tiles/techs";
import { moveBuild } from "./buildings";
import { moveSpaceshipAction } from "./spaceship-actions";

function createLostFleetRoundMoveEngine(
  nbPlayers: number,
  factions: Faction[] = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits]
) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-spaceship-actions-${nbPlayers}`], { lostFleet: true });

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

function availableSpaceshipActionCommand(
  engine: Engine,
  player: PlayerEnum
): AvailableCommand<Command.SpaceshipAction> | undefined {
  engine.clearAvailableCommands();
  return engine.findAvailableCommand(player, Command.SpaceshipAction);
}

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

function cheapestTransdimHex(engine: Engine, player: PlayerEnum): { hex: GaiaHex; qicNeeded: number } | undefined {
  const pl = engine.player(player);
  let best: { hex: GaiaHex; qicNeeded: number } | undefined;

  for (const hex of engine.map.grid.values()) {
    if (hex.data.planet !== Planet.Transdim || hex.data.building) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay).amount;
    if (!best || qicNeeded < best.qicNeeded) {
      best = { hex, qicNeeded };
    }
  }

  return best;
}

/** Cheapest non-Transdim, unoccupied planet that currently requires at least 1 QIC of range extension. */
function cheapestRangeExtendableHex(engine: Engine, player: PlayerEnum): { hex: GaiaHex; qicNeeded: number } | undefined {
  const pl = engine.player(player);
  let best: { hex: GaiaHex; qicNeeded: number } | undefined;

  for (const hex of engine.map.grid.values()) {
    if (!hex.hasPlanet() || hex.data.planet === Planet.Transdim || hex.occupied()) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay).amount;
    if (qicNeeded > 0 && (!best || qicNeeded < best.qicNeeded)) {
      best = { hex, qicNeeded };
    }
  }

  return best;
}

/** Cheapest unoccupied Asteroid planet the player could colonize. */
function cheapestAsteroidHex(engine: Engine, player: PlayerEnum): { hex: GaiaHex; qicNeeded: number } | undefined {
  const pl = engine.player(player);
  let best: { hex: GaiaHex; qicNeeded: number } | undefined;

  for (const hex of engine.map.grid.values()) {
    if (hex.data.planet !== Planet.Asteroid || !pl.canOccupy(hex)) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay).amount;
    if (!best || qicNeeded < best.qicNeeded) {
      best = { hex, qicNeeded };
    }
  }

  return best;
}

/** Cheapest unoccupied, non-Transdim/Asteroid planet that needs at least 2 terraforming steps (so T F Mars's 1 free step still leaves an ore cost). */
function cheapestHexNeedingExtraTerraforming(
  engine: Engine,
  player: PlayerEnum,
  faction: Faction
): { hex: GaiaHex; qicNeeded: number; steps: number } | undefined {
  const pl = engine.player(player);
  let best: { hex: GaiaHex; qicNeeded: number; steps: number } | undefined;

  for (const hex of engine.map.grid.values()) {
    if (hex.data.planet === Planet.Transdim || hex.data.planet === Planet.Asteroid || !pl.canOccupy(hex)) {
      continue;
    }
    const steps = terraformingStepsRequired(faction, hex.data.planet);
    if (steps < 2) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay).amount;
    if (!best || qicNeeded < best.qicNeeded) {
      best = { hex, qicNeeded, steps };
    }
  }

  return best;
}

describe("Lost Fleet spaceship board actions", () => {
  it("should not offer a ship's actions until it has been explored", () => {
    const engine = createLostFleetRoundMoveEngine(3);

    expect(availableSpaceshipActionCommand(engine, PlayerEnum.Player1)).to.equal(undefined);
  });

  it("should not offer an action the player cannot afford", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    player.data.qics = 1; // T F Mars' QIC action costs 2q
    player.data.power = new Power(0, 0, 0, 0); // T F Mars' Power action costs 2pw
    player.data.credits = 2; // T F Mars' Credit action costs 3c

    expect(availableSpaceshipActionCommand(engine, PlayerEnum.Player1)).to.equal(undefined);
  });

  it("should offer an affordable action, lock it for every player once taken, and survive serialization", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    engine.player(PlayerEnum.Player1).data.explorationShips[Spaceship.TFMars] = 1;
    engine.player(PlayerEnum.Player2).data.explorationShips[Spaceship.TFMars] = 1;

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    expect(command).to.not.equal(undefined);

    const action = command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "qic");
    expect(action).to.deep.equal({ ship: Spaceship.TFMars, type: "qic", cost: "2q" });

    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.TFMars, "qic");

    expect(engine.spaceshipActions[Spaceship.TFMars].qic).to.equal(PlayerEnum.Player1);
    expect(availableSpaceshipActionCommand(engine, PlayerEnum.Player2)).to.equal(undefined);

    const restored = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    expect(restored.spaceshipActions[Spaceship.TFMars].qic).to.equal(PlayerEnum.Player1);
  });

  it("should pay 3 QIC and rescore an owned Federation token via Twilight's QIC action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Twilight] = 1;
    player.data.tiles.federations.push({ tile: Federation.Fed2, green: false });

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Twilight && a.type === "qic");
    expect(action.cost).to.equal("3q");

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;

    // Fed2 rewards 8vp + 1 QIC when rescored
    engine.turnMoves = ["fedtile fed2"];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Twilight, "qic");

    expect(player.data.victoryPoints).to.equal(beforeVp + 8);
    expect(player.data.qics).to.equal(beforeQic - 3 + 1);
  });

  it("should pay 1 Knowledge, grant +3 temporary range, and let the player build a mine beyond normal range for free via Twilight's Knowledge action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Twilight] = 1;
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const target = cheapestRangeExtendableHex(engine, PlayerEnum.Player1);
    expect(target, "need a planet outside normal range").to.not.equal(undefined);
    expect(
      qicForDistance(engine.map, target.hex, player, engine.replay, 3).amount,
      "+3 range should cover the cheapest extendable hex for free"
    ).to.equal(0);

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Twilight && a.type === "knowledge");
    expect(action.cost).to.equal("1k");

    const beforeKnowledge = player.data.knowledge;
    const beforeQic = player.data.qics;

    engine.turnMoves = [`build m ${target.hex.toString()}`];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Twilight, "knowledge");

    expect(player.data.knowledge).to.equal(beforeKnowledge - 1);
    expect(player.data.qics).to.equal(beforeQic);
    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(target.hex.data.player).to.equal(PlayerEnum.Player1);
  });

  it("should pay 3 QIC, claim a Tech tile, and trigger the chained research upgrade via Rebellion's QIC action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Rebellion] = 1;

    const positions = TechTilePos.values(engine.expansions);
    const tiles = TechTile.values(engine.expansions);
    positions.forEach((pos, index) => {
      engine.tiles.techs[pos] = { tile: tiles[index], count: 1 };
    });

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Rebellion && a.type === "qic");
    expect(action.cost).to.equal("3q");

    const beforeQic = player.data.qics;
    const beforeGaia = player.data.research[ResearchField.GaiaProject];

    engine.turnMoves = ["tech free1", "up gaia"];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Rebellion, "qic");

    expect(player.data.qics).to.equal(beforeQic - 3);
    expect(player.data.tiles.techs.find((tech) => tech.pos === TechTilePos.Free1)).to.not.equal(undefined);
    expect(player.data.research[ResearchField.GaiaProject]).to.equal(beforeGaia + 1);
  });

  it("should pay 2 Knowledge and gain 2 credits + 1 QIC via Rebellion's Knowledge action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Rebellion] = 1;

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Rebellion && a.type === "knowledge");
    expect(action.cost).to.equal("2k");

    const beforeKnowledge = player.data.knowledge;
    const beforeCredits = player.data.credits;
    const beforeQic = player.data.qics;

    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Rebellion, "knowledge");

    expect(player.data.knowledge).to.equal(beforeKnowledge - 2);
    expect(player.data.credits).to.equal(beforeCredits + 2);
    expect(player.data.qics).to.equal(beforeQic + 1);
  });

  it("should pay 2 QIC and gain VP scaled by owned Standard Tech tiles via T F Mars's QIC action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    player.data.tiles.techs.push(
      { tile: TechTile.Tech1, pos: TechTilePos.Terraforming, enabled: false }, // covered by the Advanced tile below
      { tile: TechTile.Tech4, pos: TechTilePos.Economy, enabled: true },
      { tile: AdvTechTile.AdvTech1, pos: AdvTechTilePos.Terraforming, enabled: true }
    );

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "qic");
    expect(action.cost).to.equal("2q");

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;

    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.TFMars, "qic");

    // 2 Standard Tech tiles (the covered one still counts); the Advanced tile covering one of
    // them does not add a separate +1.
    expect(player.data.victoryPoints).to.equal(beforeVp + 2 + 2);
    expect(player.data.qics).to.equal(beforeQic - 2);
  });

  it("should pay 2 QIC and gain VP scaled by distinct colonized planet types via Eclipse's QIC action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Eclipse] = 1;
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 3);

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Eclipse && a.type === "qic");
    expect(action.cost).to.equal("2q");

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;

    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Eclipse, "qic");

    expect(player.data.victoryPoints).to.equal(beforeVp + 2 + 3);
    expect(player.data.qics).to.equal(beforeQic - 2);
  });

  it("should pay 3 Power + 2 Knowledge and trigger a free research upgrade via Eclipse's Power action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Eclipse] = 1;

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Eclipse && a.type === "power");
    expect(action.cost).to.equal("3pw,2k");

    const beforeKnowledge = player.data.knowledge;
    const beforeNav = player.data.research[ResearchField.Navigation];

    engine.turnMoves = ["up nav"];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Eclipse, "power");

    expect(player.data.knowledge).to.equal(beforeKnowledge - 2);
    expect(player.data.research[ResearchField.Navigation]).to.equal(beforeNav + 1);
  });

  it("should pay 2 Power, plus any range QIC cost, and convert a Transdim planet into Gaia via T F Mars's Power action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const target = cheapestTransdimHex(engine, PlayerEnum.Player1);
    expect(target, "need a Transdim planet on the board").to.not.equal(undefined);

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "power");
    expect(action.cost).to.equal("2pw");

    const beforePower = player.data.power.area3;
    const beforeQic = player.data.qics;
    const beforeGaiaformers = player.data.getResources(Resource.GaiaFormer);

    engine.turnMoves = [`gaiaFormTransdim ${target.hex.toString()}`];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.TFMars, "power");

    expect(player.data.power.area3).to.equal(beforePower - 2);
    expect(player.data.qics).to.equal(beforeQic - target.qicNeeded);
    expect(target.hex.data.planet).to.equal(Planet.Gaia);
    expect(target.hex.data.building).to.equal(Building.GaiaFormer);
    expect(target.hex.data.player).to.equal(PlayerEnum.Player1);
    expect(player.data.buildings[Building.GaiaFormer]).to.equal(1);
    expect(player.data.getResources(Resource.GaiaFormer)).to.equal(beforeGaiaformers - 1);

    engine.clearAvailableCommands();
    const buildCommand = engine.findAvailableCommand(PlayerEnum.Player1, Command.Build);
    const buildMine = buildCommand.data.buildings.find(
      (b) => b.coordinates === target.hex.toString() && b.building === Building.Mine && b.upgrade
    );
    expect(buildMine, "instant-gaiaformed planet should upgrade from Gaiaformer to Mine").to.not.equal(undefined);

    moveBuild(engine, buildCommand, PlayerEnum.Player1, Building.Mine, target.hex.toString());

    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(player.data.buildings[Building.GaiaFormer]).to.equal(0);
    expect(player.data.getResources(Resource.GaiaFormer)).to.equal(beforeGaiaformers);
  });

  it("should not offer T F Mars's Power action when the player has no available Gaiaformer", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    player.data.gaiaformers = 0;

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    expect(command).to.not.equal(undefined);
    expect(command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "power")).to.equal(undefined);
  });

  it("should pay 6 credits and place a free Mine on an Asteroid in range via Eclipse's Credit action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Eclipse] = 1;
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const target = cheapestAsteroidHex(engine, PlayerEnum.Player1);
    expect(target, "need an Asteroid planet on the board").to.not.equal(undefined);

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Eclipse && a.type === "credit");
    expect(action.cost).to.equal("6c");

    const beforeCredits = player.data.credits;
    const beforeQic = player.data.qics;
    const beforeOres = player.data.ores;

    engine.turnMoves = [`build m ${target.hex.toString()}`];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Eclipse, "credit");

    expect(player.data.credits).to.equal(beforeCredits - 6);
    expect(player.data.qics).to.equal(beforeQic - target.qicNeeded);
    expect(player.data.ores).to.equal(beforeOres);
    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(target.hex.data.player).to.equal(PlayerEnum.Player1);
  });

  it("should not consume a Gaiaformer for Eclipse's Credit-action Asteroid mine (§C4; fuzzer finding LF-3)", () => {
    // §C4: "the mine itself is free (the 6 credits is the entire cost — distinct from the
    // standard Asteroid-mine route in E2, which instead requires consuming a Gaiaformer)".
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Eclipse] = 1;
    player.data.gaiaformers = 1; // a spare Gaiaformer, which must survive the action
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const target = cheapestAsteroidHex(engine, PlayerEnum.Player1);
    expect(target, "need an Asteroid planet on the board").to.not.equal(undefined);

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    engine.turnMoves = [`build m ${target.hex.toString()}`];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Eclipse, "credit");

    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(player.data.gaiaformersUsedForAsteroid).to.equal(0);
  });

  it("should pay 3 credits, terraform beyond the 1 free step using ore, and build a Mine via T F Mars's Credit action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const target = cheapestHexNeedingExtraTerraforming(engine, PlayerEnum.Player1, Faction.Terrans);
    expect(target, "need a planet at least 2 terraforming steps away").to.not.equal(undefined);
    const expectedOreCost = terraformingCost(player.data, target.steps - 1, engine.replay).count;
    const mineCost = player.board.cost(Building.Mine, false);
    const mineCreditCost = mineCost.find((r) => r.type === Resource.Credit)?.count ?? 0;
    const mineOreCost = mineCost.find((r) => r.type === Resource.Ore)?.count ?? 0;

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "credit");
    expect(action.cost).to.equal("3c");

    const beforeCredits = player.data.credits;
    const beforeQic = player.data.qics;
    const beforeOres = player.data.ores;

    engine.turnMoves = [`build m ${target.hex.toString()}`];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.TFMars, "credit");

    // The 3c ship fee only covers 1 terraforming step; the mine's normal building cost (credits + ore)
    // and any further terraforming steps are still paid for separately.
    expect(player.data.credits).to.equal(beforeCredits - 3 - mineCreditCost);
    expect(player.data.qics).to.equal(beforeQic - target.qicNeeded);
    expect(player.data.ores).to.equal(beforeOres - mineOreCost - expectedOreCost);
    expect(target.hex.data.building).to.equal(Building.Mine);
    expect(target.hex.data.player).to.equal(PlayerEnum.Player1);
  });

  it("should pay 3 Power + 1 Ore and upgrade an isolated Mine into a Trading Station via Rebellion's Power action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Rebellion] = 1;
    const [hex] = occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Rebellion && a.type === "power");
    expect(action.cost).to.equal("3pw,1o");

    const beforePower = player.data.power.area3;
    const beforeOres = player.data.ores;

    engine.turnMoves = [`build ts ${hex.toString()}`];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Rebellion, "power");

    expect(player.data.power.area3).to.equal(beforePower - 3);
    expect(player.data.ores).to.equal(beforeOres - 1);
    expect(hex.data.building).to.equal(Building.TradingStation);
  });

  it("should pay 3 Power + 2 Ore and upgrade a Trading Station into a Research Lab via Twilight's Power action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Twilight] = 1;
    const [hex] = occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);
    hex.data.building = Building.TradingStation;
    player.data.buildings[Building.Mine] -= 1;
    player.data.buildings[Building.TradingStation] += 1;

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.Twilight && a.type === "power");
    expect(action.cost).to.equal("3pw,2o");

    const beforePower = player.data.power.area3;
    const beforeOres = player.data.ores;

    // Building a Research Lab grants a Tech tile, which forces a free research-track advance too
    engine.turnMoves = [`build lab ${hex.toString()}`, "tech free1", "up nav"];
    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.Twilight, "power");

    expect(player.data.power.area3).to.equal(beforePower - 3);
    expect(player.data.ores).to.equal(beforeOres - 2);
    expect(hex.data.building).to.equal(Building.ResearchLab);
  });

  it("should additionally grant 4 VP per Q.I.C. action via the qaction Advanced Tech tile (RULES_CLARIFICATIONS.md §G2)", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    player.loadEvents(techTileEventWithSource(AdvTechTile.QAction, AdvTechTile.QAction));

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "qic");
    expect(action.cost).to.equal("2q");

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;

    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.TFMars, "qic");

    // T F Mars's own qic action grants 2 VP (+0 from "tt > vp", no tech tiles owned);
    // qaction adds a further 4 VP on top, for this and every other Q.I.C. action.
    expect(player.data.victoryPoints).to.equal(beforeVp + 2 + 4);
    expect(player.data.qics).to.equal(beforeQic - 2);
  });

  it("should not offer the research-board Q.I.C. actions, replaced by the spaceship boards' own (RULES_CLARIFICATIONS.md §E4/§K3)", () => {
    const engine = createLostFleetRoundMoveEngine(3);

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Action);

    const names = command?.data.poweracts.map((a) => a.name) ?? [];
    expect(names).to.not.include.members(["qic1", "qic2", "qic3"]);
  });
});
