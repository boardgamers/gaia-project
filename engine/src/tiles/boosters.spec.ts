import { expect } from "chai";
import { qicForDistance } from "../cost";
import Engine from "../engine";
import {
  Booster,
  Building,
  Command,
  Expansion,
  Faction,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum,
  Resource,
} from "../enums";
import { GaiaHex } from "../gaia-hex";
import { moveSpecial } from "../move/actions";
import { moveBuild } from "../move/buildings";
import { Power } from "../player-data";

const parseMoves = Engine.parseMoves;

function createLostFleetBoosterEngine(
  nbPlayers = 2,
  factions: Faction[] = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits]
) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-boosters-${nbPlayers}`], { lostFleet: true });

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

function occupyHex(engine: Engine, player: PlayerEnum, hex: GaiaHex, building = Building.Mine) {
  const pl = engine.player(player);
  hex.data.player = player;
  hex.data.building = building;
  pl.data.occupied.push(hex);
  pl.data.buildings[building] += 1;
}

function occupyPlanetsOfDistinctTypes(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
  const hexes: GaiaHex[] = [];
  const seenTypes = new Set<Planet>();

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
  hexes.forEach((hex) => occupyHex(engine, player, hex));
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

describe("boosters", () => {
  it("should only include the 4 Lost Fleet boosters when the expansion is enabled", () => {
    expect(Booster.values(Expansion.None)).to.have.length(10);
    expect(Booster.values(Expansion.None)).to.not.include.members([
      Booster.LostFleetFormer,
      Booster.LostFleetPlanet,
      Booster.LostFleetDeep,
      Booster.LostFleetInstant,
    ]);

    expect(Booster.values(Expansion.LostFleet)).to.have.length(14);
    expect(Booster.values(Expansion.LostFleet)).to.include.members([
      Booster.LostFleetFormer,
      Booster.LostFleetPlanet,
      Booster.LostFleetDeep,
      Booster.LostFleetInstant,
    ]);
  });

  it("should have the correct number of round boosters depending on the number of players", () => {
    const engine2 = new Engine(["init 2 randomSeed"]);
    const engine3 = new Engine(["init 3 randomSeed"]);
    const engine4 = new Engine(["init 4 randomSeed"]);
    const engine5 = new Engine(["init 5 randomSeed"]);

    expect(Object.keys(engine2.tiles.boosters)).to.have.length(5);
    expect(Object.keys(engine3.tiles.boosters)).to.have.length(6);
    expect(Object.keys(engine4.tiles.boosters)).to.have.length(7);
    expect(Object.keys(engine5.tiles.boosters)).to.have.length(8);
  });

  it("should throw when selecting invalid round booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster2
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it("should throw when selecting taken round booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster4
    `);

    expect(() => new Engine(moves)).to.throw();
  });

  it("should gain 2 victory points when upgrading to ts and having booster7", () => {
    // booster7: ["o", "ts | 2vp"]
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster7
      p1 booster booster3
      p1 build m -4x0.
      p2 build ts -5x5.
      p1 charge 1pw
      p1 pass booster4 returning booster3
    `);

    const engine = new Engine(moves);
    const vp = engine.player(PlayerEnum.Player2).data.victoryPoints;

    engine.move("p2 pass booster3");

    expect(engine.player(PlayerEnum.Player2).data.victoryPoints).to.equal(vp + 2);
  });

  it("should allow to use a terraforming special action from a booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -1x2
      p2 booster booster5
      p1 booster booster4
    `);
    const engine = new Engine(moves);

    expect(() => new Engine([...moves, "p1 special step"])).to.not.throw();
    // tslint:disable-next-line no-unused-expression
    expect(
      new Engine([...moves, "p1 special step. build m -2x2."]).player(PlayerEnum.Player1).events[Operator.Activate][0]
        .activated
    ).to.be.true;

    // The step special action can't be used to build a gaia-former
    expect(() => new Engine([...moves, "p1 special step. build gf -2x3."])).to.throw();

    // test free action before and after, and to build something different then a mine
    expect(() => new Engine([...moves, "p1 spend 2o for 2c. special step. build m -1x-1"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 spend 1o for 1c. special step. build ts -4x2"])).to.throw();
    expect(() => new Engine([...moves, "p1 special step. build m -1x-1. spend 1o for 1c."])).to.not.throw();
  });

  it("should allow to use a range special action from a booster", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster5
    `);

    expect(() => new Engine([...moves, "p1 special range+3. build m -4x-1"])).to.not.throw();
    expect(() => new Engine([...moves, "p1 special range+3. build gf 0x4"])).to.not.throw();
  });

  it("should not allow range booster to be used when building is impossible", () => {
    const moves = parseMoves(`
      init 2 661
      p1 faction ivits
      p2 faction firaks
      firaks build m 4A0
      ivits build PI 2A3
      firaks build m 3A3
      firaks booster booster4
      ivits booster booster5
      ivits build m 2A7.
      firaks pass booster9 returning booster4
      ivits spend 1o for 1t. special range+3.
    `);

    expect(() => new Engine([...moves], { factionVariant: "more-balanced" })).to.throw(
      "Command endturn is not in the list of available commands"
    );
  });

  it("should keep the Lost Fleet booster pool size at players plus 3", () => {
    const engine = new Engine(["init 3 randomSeed"], { lostFleet: true });

    expect(Object.keys(engine.tiles.boosters)).to.have.length(6);
    expect(
      Object.keys(engine.tiles.boosters).every((booster) =>
        Booster.values(engine.expansions).includes(booster as Booster)
      )
    ).to.be.true;
  });

  it("should score 3 VP per Gaiaformer on board or deployed, but not asteroid-consumed, from the Lost Fleet former booster", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetFormer);

    player.data.gaiaformers = 4;
    player.data.gaiaformersInGaia = 1;
    player.data.gaiaformersUsedForAsteroid = 1;
    player.data.buildings[Building.GaiaFormer] = 1;

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 6);
  });

  it("should still score a Gaiaformer converted to Q.I.C. (e.g. via Baltaks' free action) from the Lost Fleet former booster", () => {
    // Owner-confirmed ruling only excludes Gaiaformers used to colonize an asteroid; a Gaiaformer
    // spent on Baltaks' "1gf -> 1q" free action still counts toward the pass bonus.
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetFormer);

    player.data.gaiaformers = 2;
    player.data.gaiaformersInGaia = 1;
    player.data.gaiaformersUsedForOther = 1;

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 6);
  });

  it("should score 1 VP per distinct colonized planet type from the Lost Fleet planet booster", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetPlanet);

    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 3);

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 3);
  });

  it("should score 2 VP per distinct colonized Deep Space sector from the Lost Fleet deep booster", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetDeep);

    const deepSpaceBySector = new Map<string, GaiaHex[]>();
    for (const hex of engine.map.grid.values()) {
      if (!hex.data.sector.startsWith("DS") || !hex.hasPlanet()) {
        continue;
      }
      const sectorKey = hex.data.sector.replace(/_\d+$/, "");
      const list = deepSpaceBySector.get(sectorKey) ?? [];
      list.push(hex);
      deepSpaceBySector.set(sectorKey, list);
    }

    const sectors = [...deepSpaceBySector.values()];
    const sectorWithTwoPlanets = sectors.find((sector) => sector.length >= 2);
    const otherSector = sectors.find((sector) => sector !== sectorWithTwoPlanets && sector.length >= 1);
    expect(sectorWithTwoPlanets).to.not.equal(undefined);
    expect(otherSector).to.not.equal(undefined);

    occupyHex(engine, PlayerEnum.Player1, sectorWithTwoPlanets[0]);
    occupyHex(engine, PlayerEnum.Player1, sectorWithTwoPlanets[1]);
    occupyHex(engine, PlayerEnum.Player1, otherSector[0]);

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 4);
  });

  it("should count the Lost Planet when it is placed in a Deep Space sector for the Lost Fleet deep booster", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetDeep);

    const deepSpaceBySector = new Map<string, GaiaHex[]>();
    for (const hex of engine.map.grid.values()) {
      if (!hex.data.sector.startsWith("DS")) {
        continue;
      }
      const sectorKey = hex.data.sector.replace(/_\d+$/, "");
      const list = deepSpaceBySector.get(sectorKey) ?? [];
      list.push(hex);
      deepSpaceBySector.set(sectorKey, list);
    }

    const sectors = [...deepSpaceBySector.values()];
    const regularSector = sectors.find((sector) => sector.some((hex) => hex.hasPlanet()));
    const lostPlanetSector = sectors.find(
      (sector) => sector !== regularSector && sector.some((hex) => hex.data.planet === Planet.Empty)
    );
    expect(regularSector).to.not.equal(undefined);
    expect(lostPlanetSector).to.not.equal(undefined);

    occupyHex(
      engine,
      PlayerEnum.Player1,
      regularSector.find((hex) => hex.hasPlanet())
    );

    const lostPlanetHex = lostPlanetSector.find((hex) => hex.data.planet === Planet.Empty);
    lostPlanetHex.data.planet = Planet.Lost;
    occupyHex(engine, PlayerEnum.Player1, lostPlanetHex);

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 4);
  });

  it("should grant 2 power income from the Lost Fleet instant booster", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetInstant);

    expect(player.resourceIncome(Resource.ChargePower)).to.equal(2);
  });

  it("should use the Lost Fleet instant booster like T F Mars instant Gaiaforming, with the Gaiaformer occupying the planet", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetInstant);
    player.data.gaiaformers = 1;

    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    const target = cheapestTransdimHex(engine, PlayerEnum.Player1);
    expect(target, "need a Transdim planet on the board").to.not.equal(undefined);
    const chosenTarget = target;

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Special);
    expect(command).to.not.equal(undefined);
    expect(command.data.specialacts.some((action) => action.income === Resource.InstantGaiaforming)).to.be.true;

    const beforeQic = player.data.qics;
    const beforePower = player.data.power.area3;
    const beforeGaiaformers = player.data.getResources(Resource.GaiaFormer);

    engine.turnMoves = [`gaiaFormTransdim ${chosenTarget.hex.toString()}`];
    moveSpecial(engine, command, PlayerEnum.Player1, Resource.InstantGaiaforming);

    expect(player.data.qics).to.equal(beforeQic - chosenTarget.qicNeeded);
    expect(player.data.power.area3).to.equal(beforePower);
    expect(chosenTarget.hex.data.planet).to.equal(Planet.Gaia);
    expect(chosenTarget.hex.data.building).to.equal(Building.GaiaFormer);
    expect(chosenTarget.hex.data.player).to.equal(PlayerEnum.Player1);
    expect(player.data.buildings[Building.GaiaFormer]).to.equal(1);
    expect(player.data.getResources(Resource.GaiaFormer)).to.equal(beforeGaiaformers - 1);

    engine.clearAvailableCommands();
    const buildCommand = engine.findAvailableCommand(PlayerEnum.Player1, Command.Build);
    const buildMine = buildCommand.data.buildings.find(
      (b) => b.coordinates === chosenTarget.hex.toString() && b.building === Building.Mine && b.upgrade
    );
    expect(buildMine, "instant-gaiaformed planet should upgrade from Gaiaformer to Mine").to.not.equal(undefined);

    moveBuild(engine, buildCommand, PlayerEnum.Player1, Building.Mine, chosenTarget.hex.toString());

    expect(chosenTarget.hex.data.building).to.equal(Building.Mine);
    expect(player.data.buildings[Building.GaiaFormer]).to.equal(0);
    expect(player.data.getResources(Resource.GaiaFormer)).to.equal(beforeGaiaformers);
  });

  it("should not offer the Lost Fleet instant booster action when the player has no available Gaiaformer", () => {
    const engine = createLostFleetBoosterEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.getRoundBooster(Booster.LostFleetInstant);
    player.data.gaiaformers = 0;
    occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

    engine.clearAvailableCommands();
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Special);

    expect(command).to.equal(undefined);
  });
});
