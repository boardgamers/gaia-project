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

describe("the analysis sandbox's second Trading Station (viewer ANALYSIS_MODE_PLAN.md, owner instruction 2026-08-19)", () => {
  const SETUP = [
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

  function richGame() {
    const engine = new Engine(SETUP);
    engine.player(PlayerEnum.Player1).data.credits = 20;
    engine.player(PlayerEnum.Player1).data.ores = 20;
    return engine;
  }

  function tradingStations(engine: Engine) {
    engine.clearAvailableCommands();
    engine.generateAvailableCommands();
    return (engine.findAvailableCommand(PlayerEnum.Player1, Command.Build)?.data.buildings ?? []).filter(
      (b) => b.building === Building.TradingStation
    );
  }

  it("is not offered at all in a real game", () => {
    expect(tradingStations(richGame()).some((b) => b.analysisCheap)).to.equal(false);
  });

  it("is offered alongside the isolated price once the seat is flagged as the sandbox", () => {
    const engine = richGame();
    engine.player(PlayerEnum.Player1).data.analysis = true;

    const offers = tradingStations(engine);
    const isolated = offers.find((b) => !b.analysisCheap && b.cost === "6c,2o");
    expect(isolated, "an isolated (6c) Trading Station to duplicate").to.not.equal(undefined);

    const cheap = offers.find((b) => b.analysisCheap && b.coordinates === isolated!.coordinates);
    expect(cheap, "the same hex offered at the neighbour price").to.not.equal(undefined);
    expect(cheap!.cost).to.equal("3c,2o");
  });

  it("is not duplicated for a hex that already has a neighbour - the two entries would be identical", () => {
    const engine = richGame();
    engine.player(PlayerEnum.Player1).data.analysis = true;

    for (const cheap of tradingStations(engine).filter((b) => b.analysisCheap)) {
      const real = tradingStations(engine).find((b) => !b.analysisCheap && b.coordinates === cheap.coordinates);
      expect(real!.cost, `${cheap.coordinates} was already cheap`).to.equal("6c,2o");
    }
  });

  it("charges the neighbour price when the move carries the qualifier, and the isolated one when it does not", () => {
    const engine = richGame();
    engine.player(PlayerEnum.Player1).data.analysis = true;
    const isolated = tradingStations(engine).find((b) => !b.analysisCheap && b.cost === "6c,2o")!;

    const cheapRun = richGame();
    cheapRun.player(PlayerEnum.Player1).data.analysis = true;
    cheapRun.move(`terrans build ts ${isolated.coordinates} cheap.`);
    expect(cheapRun.player(PlayerEnum.Player1).data.credits).to.equal(17);

    const fullRun = richGame();
    fullRun.player(PlayerEnum.Player1).data.analysis = true;
    fullRun.move(`terrans build ts ${isolated.coordinates}.`);
    expect(fullRun.player(PlayerEnum.Player1).data.credits).to.equal(14);
  });

  it("cannot be played in a real game - there is no such entry to match", () => {
    const engine = richGame();
    const isolated = tradingStations(engine).find((b) => b.cost === "6c,2o")!;

    expect(() => engine.move(`terrans build ts ${isolated.coordinates} cheap.`)).to.throw();
  });

  it("leaves an ordinary trailing log annotation alone", () => {
    // Build moves already carry these ("build gf 6A9 using area1: 6."), and moveBuild has always
    // ignored them - the qualifier is read positionally, straight after the location, not by
    // scanning every trailing token.
    const engine = richGame();
    const isolated = tradingStations(engine).find((b) => b.cost === "6c,2o")!;

    expect(() => engine.move(`terrans build ts ${isolated.coordinates} using area1: 0.`)).to.not.throw();
  });
});
