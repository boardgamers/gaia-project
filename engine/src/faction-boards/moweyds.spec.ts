import { expect } from "chai";
import Engine from "../engine";
import { possibleSpecialActions } from "../available/actions";
import { factionBoard } from ".";
import { Building, Faction, Phase, Planet, Player as PlayerEnum, Resource, Spaceship } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { moveSpecial } from "../move/actions";
import { Power } from "../player-data";

describe("Moweyds", () => {
  const board = factionBoard(Faction.Moweyds);
  const defaults = factionBoard(Faction.Terrans);

  it("should have power Area I = 4 and Area II = 4", () => {
    expect(board.power).to.deep.equal({ area1: 4, area2: 4 });
  });

  it("should use standard building costs", () => {
    for (const building of [
      Building.Mine,
      Building.TradingStation,
      Building.ResearchLab,
      Building.Academy1,
      Building.Academy2,
      Building.PlanetaryInstitute,
    ]) {
      expect(board.cost(building, false)).to.deep.equal(defaults.cost(building, false));
    }
  });

  it("should grant a free Gaiaforming research step on game start", () => {
    const setupRewards = board.income[0].rewards;

    expect(setupRewards.some((r) => r.type === Resource.UpgradeGaiaProject)).to.be.true;
  });

  it("should load a Power Ring special action onto the Planetary Institute", () => {
    const piRewards = board.buildings[Building.PlanetaryInstitute].income[0].flatMap((event) => event.rewards);

    expect(piRewards.some((r) => r.type === Resource.PowerRing && r.count === 1)).to.be.true;
  });

  it("should start the game with an Exploration Shuttle on T F Mars after factions are chosen", () => {
    const engine = new Engine(["init 2 lost-fleet-moweyds-start-shuttle"], { lostFleet: true });

    engine.move(`p1 faction ${Faction.Moweyds}`);
    engine.move(`p2 faction ${Faction.Terrans}`);

    expect(engine.player(PlayerEnum.Player1).data.explorationShips[Spaceship.TFMars]).to.equal(1);
  });

  it("should place a Power Ring via the PI action and increase that structure's power value by 2", () => {
    const engine = new Engine(["init 2 lost-fleet-moweyds-power-ring"], { lostFleet: true });

    engine.players[0].faction = Faction.Moweyds;
    engine.players[0].loadFaction(null, engine.expansions);
    engine.players[0].data.victoryPoints = 30;
    engine.players[0].data.qics = 10;
    engine.players[0].data.credits = 20;
    engine.players[0].data.knowledge = 10;
    engine.players[0].data.ores = 10;
    engine.players[0].data.power = new Power(4, 4, 4, 0);

    engine.players[1].faction = Faction.Terrans;
    engine.players[1].loadFaction(null, engine.expansions);

    engine.phase = Phase.RoundMove;
    engine.round = 1;
    engine.turnOrder = engine.players.map((pl) => pl.player);
    engine.currentPlayer = PlayerEnum.Player1;

    const hex = [...engine.map.grid.values()].find(
      (space) => space.hasPlanet() && space.data.spaceship === undefined && !space.occupied()
    ) as GaiaHex;
    hex.data.player = PlayerEnum.Player1;
    hex.data.building = Building.PlanetaryInstitute;

    const player = engine.player(PlayerEnum.Player1);
    player.data.occupied.push(hex);
    player.data.buildings[Building.PlanetaryInstitute] = 1;
    player.loadEvents(player.board.buildings[Building.PlanetaryInstitute].income[0]);

    const [command] = possibleSpecialActions(engine, PlayerEnum.Player1);
    expect(command.data.specialacts.some((entry) => entry.income === "power-ring")).to.be.true;

    engine.turnMoves = [`placePowerRing ${hex.toString()}`];
    moveSpecial(engine, command, PlayerEnum.Player1, "power-ring");

    expect(hex.data.powerRing).to.equal(PlayerEnum.Player1);
    expect(player.data.powerRingsPlaced).to.equal(1);
    expect(player.buildingValue(hex, { federation: true })).to.equal(5);
    expect(possibleSpecialActions(engine, PlayerEnum.Player1)).to.deep.equal([]);
  });

  it("should allow placing a Power Ring on the Lost Planet mine", () => {
    const engine = new Engine(["init 2 lost-fleet-moweyds-lost-planet-ring"], { lostFleet: true });

    engine.players[0].faction = Faction.Moweyds;
    engine.players[0].loadFaction(null, engine.expansions);
    engine.players[0].data.victoryPoints = 30;
    engine.players[0].data.power = new Power(4, 4, 4, 0);

    engine.players[1].faction = Faction.Terrans;
    engine.players[1].loadFaction(null, engine.expansions);

    engine.phase = Phase.RoundMove;
    engine.round = 1;
    engine.turnOrder = engine.players.map((pl) => pl.player);
    engine.currentPlayer = PlayerEnum.Player1;

    const hex = [...engine.map.grid.values()].find(
      (space) => !space.hasPlanet() && space.data.spaceship === undefined && !space.occupied()
    ) as GaiaHex;
    hex.data.planet = Planet.Lost;
    hex.data.player = PlayerEnum.Player1;
    hex.data.building = Building.Mine;

    const player = engine.player(PlayerEnum.Player1);
    player.data.occupied.push(hex);
    player.data.lostPlanet = 1;
    player.loadEvents(player.board.buildings[Building.PlanetaryInstitute].income[0]);

    const [command] = possibleSpecialActions(engine, PlayerEnum.Player1);
    expect(command.data.specialacts.some((entry) => entry.income === "power-ring")).to.be.true;

    engine.turnMoves = [`placePowerRing ${hex.toString()}`];
    moveSpecial(engine, command, PlayerEnum.Player1, "power-ring");

    expect(hex.data.powerRing).to.equal(PlayerEnum.Player1);
    expect(player.data.powerRingsPlaced).to.equal(1);
    expect(player.buildingValue(hex, { federation: true })).to.equal(3);
  });
});
