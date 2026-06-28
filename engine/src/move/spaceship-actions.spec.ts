import { expect } from "chai";
import "mocha";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import {
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Spaceship,
  TechTile,
  TechTilePos,
} from "../enums";
import { GaiaHex } from "../gaia-hex";
import { Power } from "../player-data";
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

  it("should pay 2 QIC and gain VP scaled by owned Tech tiles via T F Mars's QIC action", () => {
    const engine = createLostFleetRoundMoveEngine(3);
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.TFMars] = 1;
    player.data.tiles.techs.push(
      { tile: TechTile.Tech1, pos: TechTilePos.Terraforming, enabled: true },
      { tile: TechTile.Tech4, pos: TechTilePos.Economy, enabled: true }
    );

    const command = availableSpaceshipActionCommand(engine, PlayerEnum.Player1);
    const action = command.data.actions.find((a) => a.ship === Spaceship.TFMars && a.type === "qic");
    expect(action.cost).to.equal("2q");

    const beforeVp = player.data.victoryPoints;
    const beforeQic = player.data.qics;

    moveSpaceshipAction(engine, command, PlayerEnum.Player1, Spaceship.TFMars, "qic");

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
});
