import { expect } from "chai";
import "mocha";
import Engine from "./engine";
import { Building, Faction, Phase, Planet, Player as PlayerEnum } from "./enums";
import { FederationInfo } from "./federation";
import { GaiaHex } from "./gaia-hex";
import { classifySectorId, LostFleetSectorType } from "./lost-fleet-map";
import { Power } from "./player-data";

const defaultFactions = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits];

function createLostFleetRoundMoveEngine(
  nbPlayers: number,
  seed: string,
  factions: Faction[] = defaultFactions
): Engine {
  const engine = new Engine([`init ${nbPlayers} ${seed}`], { lostFleet: true });

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

function isFreeColonizablePlanet(hex: GaiaHex): boolean {
  return hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied();
}

function placeStructure(engine: Engine, player: PlayerEnum, coord: string, building: Building): GaiaHex {
  const hex = engine.map.getS(coord);
  const pl = engine.player(player);

  hex.data.player = player;
  hex.data.building = building;
  pl.data.occupied.push(hex);
  pl.data.buildings[building] += 1;

  return hex;
}

function federationIncluding(
  engine: Engine,
  player: PlayerEnum,
  requiredCoords: string[],
  predicate: (fed: FederationInfo) => boolean = () => true
): FederationInfo | undefined {
  return engine
    .player(player)
    .availableFederations(engine.map, false)
    .find((fed) => requiredCoords.every((coord) => fed.hexes.includes(engine.map.getS(coord))) && predicate(fed));
}

function findConnectedPlanetCluster(engine: Engine, start: GaiaHex, count: number): GaiaHex[] | undefined {
  const cluster: GaiaHex[] = [];
  const queue: GaiaHex[] = [start];
  const visited = new Set<GaiaHex>();

  while (queue.length > 0 && cluster.length < count) {
    const hex = queue.shift();
    if (visited.has(hex) || !isFreeColonizablePlanet(hex)) {
      continue;
    }

    visited.add(hex);
    cluster.push(hex);

    for (const neighbor of engine.map.grid.neighbours(hex)) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return cluster.length === count ? cluster : undefined;
}

function findPlanetParticipationScenario(
  nbPlayers: number,
  seeds: string[],
  target: (hex: GaiaHex) => boolean
): { engine: Engine; targetHex: GaiaHex; federation: FederationInfo } | undefined {
  for (const seed of seeds) {
    const template = createLostFleetRoundMoveEngine(nbPlayers, seed);
    const targets = [...template.map.grid.values()].filter((hex) => isFreeColonizablePlanet(hex) && target(hex)).map((hex) => hex.toString());

    for (const targetCoord of targets) {
      const engine = createLostFleetRoundMoveEngine(nbPlayers, seed);
      const targetHex = engine.map.getS(targetCoord);
      const cluster = findConnectedPlanetCluster(engine, targetHex, 4);

      if (!cluster) {
        continue;
      }

      placeStructure(engine, PlayerEnum.Player1, cluster[0].toString(), Building.PlanetaryInstitute);
      placeStructure(engine, PlayerEnum.Player1, cluster[1].toString(), Building.TradingStation);
      placeStructure(engine, PlayerEnum.Player1, cluster[2].toString(), Building.Mine);
      placeStructure(engine, PlayerEnum.Player1, cluster[3].toString(), Building.Mine);

      const federation = federationIncluding(engine, PlayerEnum.Player1, [targetCoord]);
      if (federation) {
        return { engine, targetHex, federation };
      }
    }
  }

  return undefined;
}

function findBlankRoutingScenario(
  nbPlayers: number,
  seeds: string[],
  sectorType: LostFleetSectorType
): { engine: Engine; blankHex: GaiaHex; federation: FederationInfo } | undefined {
  for (const seed of seeds) {
    const template = createLostFleetRoundMoveEngine(nbPlayers, seed);
    const blankCoords = [...template.map.grid.values()]
      .filter(
        (hex) =>
          !hex.hasPlanet() &&
          !hex.hasSpaceship() &&
          !hex.occupied() &&
          classifySectorId(hex.data.sector) === sectorType
      )
      .map((hex) => hex.toString());

    for (const blankCoord of blankCoords) {
      const blank = template.map.getS(blankCoord);
      const neighbors = template.map.grid.neighbours(blank).filter(isFreeColonizablePlanet).map((hex) => hex.toString());

      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          const aCoord = neighbors[i];
          const bCoord = neighbors[j];
          const a = template.map.getS(aCoord);
          const b = template.map.getS(bCoord);

          if (template.map.distance(a, b) <= 1) {
            continue;
          }

          const supportCoord = template.map.grid
            .neighbours(a)
            .find(
              (hex) =>
                isFreeColonizablePlanet(hex) &&
                hex.toString() !== blankCoord &&
                hex.toString() !== bCoord &&
                template.map.distance(hex, b) > 1
            )
            ?.toString();

          if (!supportCoord) {
            continue;
          }

          const engine = createLostFleetRoundMoveEngine(nbPlayers, seed);
          placeStructure(engine, PlayerEnum.Player1, aCoord, Building.PlanetaryInstitute);
          placeStructure(engine, PlayerEnum.Player1, supportCoord, Building.TradingStation);
          placeStructure(engine, PlayerEnum.Player1, bCoord, Building.TradingStation);

          const federation = federationIncluding(
            engine,
            PlayerEnum.Player1,
            [blankCoord, aCoord, bCoord, supportCoord],
            (fed) => fed.newSatellites === 1 && !fed.hexes.some((hex) => hex.hasSpaceship())
          );

          if (federation) {
            return { engine, blankHex: engine.map.getS(blankCoord), federation };
          }
        }
      }
    }
  }

  return undefined;
}

describe("Lost Fleet federation auto-routing", () => {
  it("can route through a blank Deep Space hex", () => {
    const scenario = findBlankRoutingScenario(2, ["lf-fed-deep-route-a", "lf-fed-deep-route-b", "lf-fed-deep-route-c"], LostFleetSectorType.DeepSpace);

    expect(scenario, "need a Lost Fleet federation scenario that routes through blank Deep Space").to.not.equal(undefined);
    expect(scenario.federation.hexes).to.include(scenario.blankHex);
    expect(scenario.federation.newSatellites).to.equal(1);
  });

  it("can route through a blank Interspace hex while still excluding spaceship hexes", () => {
    const scenario = findBlankRoutingScenario(
      4,
      ["lf-fed-interspace-route-a", "lf-fed-interspace-route-b", "lf-fed-interspace-route-c"],
      LostFleetSectorType.Interspace
    );

    expect(scenario, "need a Lost Fleet federation scenario that routes through blank Interspace").to.not.equal(undefined);
    expect(scenario.federation.hexes).to.include(scenario.blankHex);
    expect(scenario.federation.newSatellites).to.equal(1);
    expect(scenario.federation.hexes.some((hex) => hex.hasSpaceship())).to.equal(false);
  });

  [
    {
      label: "Interspace planet",
      nbPlayers: 2,
      predicate: (hex: GaiaHex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Interspace,
    },
    {
      label: "Deep Space planet",
      nbPlayers: 2,
      predicate: (hex: GaiaHex) => classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace,
    },
    {
      label: "Asteroid colony",
      nbPlayers: 2,
      predicate: (hex: GaiaHex) => hex.data.planet === Planet.Asteroid,
    },
    {
      label: "Protoplanet colony",
      nbPlayers: 2,
      predicate: (hex: GaiaHex) => hex.data.planet === Planet.Protoplanet,
    },
  ].forEach(({ label, nbPlayers, predicate }) => {
    it(`includes a ${label} in an automatically found federation`, () => {
      const scenario = findPlanetParticipationScenario(
        nbPlayers,
        [`lf-fed-${label}-a`, `lf-fed-${label}-b`, `lf-fed-${label}-c`],
        predicate
      );

      expect(scenario, `need a Lost Fleet federation scenario including a ${label}`).to.not.equal(undefined);
      expect(scenario.federation.hexes).to.include(scenario.targetHex);
      expect(scenario.federation.powerValue).to.be.at.least(7);
    });
  });

  it("lets a Moweyds PI+TS pair form a federation only after a Power Ring is added", () => {
    const engine = createLostFleetRoundMoveEngine(2, "lf-fed-moweyds-ring", [Faction.Moweyds, Faction.Terrans]);
    const targets = [...engine.map.grid.values()].filter(isFreeColonizablePlanet).map((hex) => hex.toString());

    let scenario:
      | {
          playerCoords: string;
          piHex: GaiaHex;
          federation: FederationInfo;
        }
      | undefined;

    for (const startCoord of targets) {
      const freshEngine = createLostFleetRoundMoveEngine(2, "lf-fed-moweyds-ring", [Faction.Moweyds, Faction.Terrans]);
      const piHex = freshEngine.map.getS(startCoord);
      const cluster = findConnectedPlanetCluster(freshEngine, piHex, 2);

      if (!cluster) {
        continue;
      }

      placeStructure(freshEngine, PlayerEnum.Player1, cluster[0].toString(), Building.PlanetaryInstitute);
      placeStructure(freshEngine, PlayerEnum.Player1, cluster[1].toString(), Building.TradingStation);

      const playerCoords = cluster.map((hex) => hex.toString()).join(",");
      expect(() =>
        freshEngine.player(PlayerEnum.Player1).checkAndGetFederationInfo(playerCoords, freshEngine.map, false, false)
      ).to.throw();

      cluster[0].data.powerRing = PlayerEnum.Player1;

      const federation = freshEngine
        .player(PlayerEnum.Player1)
        .checkAndGetFederationInfo(playerCoords, freshEngine.map, false, false);

      if (federation.powerValue >= 7) {
        scenario = { playerCoords, piHex: cluster[0], federation };
        break;
      }
    }

    expect(scenario, "need a Moweyds PI/TS pair that only reaches federation value with a Power Ring").to.not.equal(undefined);
    expect(scenario.piHex.data.powerRing).to.equal(PlayerEnum.Player1);
    expect(scenario.federation.hexes.map((hex) => hex.toString()).sort().join(",")).to.equal(
      scenario.playerCoords.split(",").sort().join(",")
    );
    expect(scenario.federation.powerValue).to.equal(7);
  });
});
