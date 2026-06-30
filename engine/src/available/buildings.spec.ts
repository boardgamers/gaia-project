import { expect } from "chai";
import Engine from "../engine";
import { Building, Command, Faction, Player as PlayerEnum } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { moveLostPlanet } from "../move/buildings";
import { possibleSpaceLostPlanet, possibleSpaceStations } from "./buildings";

function createLostFleetPlacementEngine(faction: Faction) {
  const engine = new Engine([`init 2 lost-fleet-ship-hex-placements-${faction}`], { lostFleet: true });

  engine.players.forEach((pl, index) => {
    pl.faction = index === 0 ? faction : Faction.Terrans;
    pl.loadFaction(null, engine.expansions);
    pl.data.qics = 10;
    pl.data.credits = 20;
    pl.data.knowledge = 10;
    pl.data.ores = 10;
  });

  occupyStartingHex(engine, PlayerEnum.Player1);

  return engine;
}

function occupyStartingHex(engine: Engine, player: PlayerEnum): GaiaHex {
  const pl = engine.player(player);
  const start = [...engine.map.grid.values()].find((hex) => hex.hasPlanet() && !hex.hasSpaceship() && !hex.occupied());

  if (!start) {
    throw new Error("need a non-ship starting hex");
  }
  start.data.player = player;
  start.data.building = Building.Mine;
  pl.data.occupied.push(start);
  pl.data.buildings[Building.Mine] += 1;

  return start;
}

function shipHexes(engine: Engine): GaiaHex[] {
  return [...engine.map.grid.values()].filter((hex) => hex.hasSpaceship());
}

describe("Lost Fleet ship hex placement guards", () => {
  it("does not offer spaceship hexes for Ivits space stations", () => {
    const engine = createLostFleetPlacementEngine(Faction.Ivits);
    const [command] = possibleSpaceStations(engine, PlayerEnum.Player1);
    if (!command) {
      throw new Error("Ivits should have space-station targets in this setup");
    }
    const coordinates = command.data.buildings.map((building) => building.coordinates);

    expect(shipHexes(engine)).to.not.be.empty;
    for (const shipHex of shipHexes(engine)) {
      expect(coordinates).to.not.include(shipHex.toString());
    }
  });

  it("does not offer spaceship hexes for Lost Planet placement", () => {
    const engine = createLostFleetPlacementEngine(Faction.Terrans);
    const [command] = possibleSpaceLostPlanet(engine, PlayerEnum.Player1);
    if (!command) {
      throw new Error("Lost Planet should have placement targets in this setup");
    }
    const coordinates = command.data.spaces.map((space) => space.coordinates);

    expect(shipHexes(engine)).to.not.be.empty;
    for (const shipHex of shipHexes(engine)) {
      expect(coordinates).to.not.include(shipHex.toString());
    }
  });

  it("rejects placing the Lost Planet on a spaceship hex even from a malformed command", () => {
    const engine = createLostFleetPlacementEngine(Faction.Terrans);
    const shipHex = shipHexes(engine)[0];

    expect(() =>
      moveLostPlanet(
        engine,
        {
          name: Command.PlaceLostPlanet,
          player: PlayerEnum.Player1,
          data: { spaces: [{ coordinates: shipHex.toString(), cost: "~", warnings: null }] },
        } as any,
        PlayerEnum.Player1,
        shipHex.toString()
      )
    ).to.throw("spaceship hex");
  });
});
