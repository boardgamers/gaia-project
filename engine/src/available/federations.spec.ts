import { expect } from "chai";
import "mocha";
import { qicForDistance, terraformingCost } from "../cost";
import Engine from "../engine";
import { Building, Faction, Phase, Planet, Player as PlayerEnum, Resource, SpaceshipFederation } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { terraformingStepsRequired } from "../planets";
import { Power } from "../player-data";
import Reward from "../reward";
import { possibleFederationTokenBuildMine } from "./federations";

function createLostFleetRoundMoveEngine(
  nbPlayers: number,
  factions: Faction[] = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits]
) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-federation-token-build-mine-${nbPlayers}`], { lostFleet: true });

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

function occupyStartingHex(engine: Engine, player: PlayerEnum): GaiaHex {
  const pl = engine.player(player);
  const start = [...engine.map.grid.values()].find(
    (hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()
  );

  start.data.player = player;
  start.data.building = Building.Mine;
  pl.data.occupied.push(start);
  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return start;
}

function findUnoccupiedHexOfPlanet(engine: Engine, planet: Planet): GaiaHex | undefined {
  return [...engine.map.grid.values()].find((hex) => hex.data.planet === planet && !hex.occupied());
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

describe("possibleFederationTokenBuildMine", () => {
  it("excludes Transdim and Asteroid hexes", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    occupyStartingHex(engine, PlayerEnum.Player1);

    const transdimHex = findUnoccupiedHexOfPlanet(engine, Planet.Transdim);
    const asteroidHex = findUnoccupiedHexOfPlanet(engine, Planet.Asteroid);
    expect(transdimHex, "need an unoccupied Transdim hex").to.not.equal(undefined);
    expect(asteroidHex, "need an unoccupied Asteroid hex").to.not.equal(undefined);

    const [command] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
      federation: SpaceshipFederation.Range,
    });
    const coords = command.data.buildings.map((b) => b.coordinates);

    expect(coords).to.not.include(transdimHex.toString());
    expect(coords).to.not.include(asteroidHex.toString());
  });

  it("waives the build cost and range QIC for the Range token, but still charges full terraforming ore", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    occupyStartingHex(engine, PlayerEnum.Player1);
    const player = engine.player(PlayerEnum.Player1);

    const target = cheapestHexNeedingRangeAndTerraforming(engine, PlayerEnum.Player1, Faction.Terrans);
    expect(target, "need a hex needing both QIC range extension and terraforming").to.not.equal(undefined);

    const [command] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
      federation: SpaceshipFederation.Range,
    });
    const building = command.data.buildings.find((b) => b.coordinates === target.hex.toString());

    expect(building, "target hex should be buildable for free range").to.not.equal(undefined);

    const cost = Reward.parse(building.cost);
    expect(cost.some((r) => r.type === Resource.Qic)).to.be.false;
    expect(cost.find((r) => r.type === Resource.Ore)?.count ?? 0).to.equal(
      terraformingCost(player.data, target.steps, engine.replay).count
    );
  });

  it("charges normal range QIC for the Terraform token, but discounts terraforming ore by up to 3 steps", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    occupyStartingHex(engine, PlayerEnum.Player1);

    const target = cheapestHexNeedingRangeAndTerraforming(engine, PlayerEnum.Player1, Faction.Terrans);
    expect(target, "need a hex needing both QIC range extension and terraforming").to.not.equal(undefined);

    const [command] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
      federation: SpaceshipFederation.Terraform,
    });
    const building = command.data.buildings.find((b) => b.coordinates === target.hex.toString());

    expect(building, "target hex should be buildable with normal range cost").to.not.equal(undefined);

    const cost = Reward.parse(building.cost);
    expect(cost.find((r) => r.type === Resource.Qic)?.count ?? 0).to.equal(target.qic);
    // terraformingStepsRequired never exceeds 3, so the "discount up to 3 steps" always waives it entirely.
    expect(cost.find((r) => r.type === Resource.Ore)?.count ?? 0).to.equal(0);
  });

  it("still charges the Gaia-forming QIC cost for Gaia planets with either token, on top of Terraform's range QIC", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    occupyStartingHex(engine, PlayerEnum.Player1);
    const player = engine.player(PlayerEnum.Player1);

    const gaiaHex = findUnoccupiedHexOfPlanet(engine, Planet.Gaia);
    expect(gaiaHex, "need an unoccupied Gaia hex").to.not.equal(undefined);

    // Range waives range QIC entirely, so only the Gaia-forming QIC applies.
    const [rangeCommand] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
      federation: SpaceshipFederation.Range,
    });
    const rangeBuilding = rangeCommand.data.buildings.find((b) => b.coordinates === gaiaHex.toString());
    expect(rangeBuilding, "Range should still allow building on Gaia planets").to.not.equal(undefined);
    expect(rangeBuilding.cost).to.equal(Reward.toString([player.gaiaFormingCost()]));

    // Terraform doesn't waive range QIC, so it stacks with the Gaia-forming QIC (same resource, merged).
    const rangeQic = qicForDistance(engine.map, gaiaHex, player, engine.replay)?.amount ?? 0;
    const [terraformCommand] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
      federation: SpaceshipFederation.Terraform,
    });
    const terraformBuilding = terraformCommand.data.buildings.find((b) => b.coordinates === gaiaHex.toString());
    expect(terraformBuilding, "Terraform should still allow building on Gaia planets").to.not.equal(undefined);
    expect(terraformBuilding.cost).to.equal(
      Reward.toString(Reward.merge([player.gaiaFormingCost(), new Reward(rangeQic, Resource.Qic)]))
    );
  });

  [Faction.Darkanians, Faction.SpaceGiants].forEach((faction) => {
    it(`charges ${faction}'s 2-QIC Gaia-forming surcharge (instead of the normal 1 QIC) on Gaia planets, for either token`, () => {
      const engine = createLostFleetRoundMoveEngine(2, [faction, Faction.Terrans]);
      occupyStartingHex(engine, PlayerEnum.Player1);
      const player = engine.player(PlayerEnum.Player1);

      // Independent of player.gaiaFormingCost(), so this can't pass merely by mirroring the
      // implementation: §G5/player.ts hardcode this surcharge at exactly 2 QIC for these 2 factions.
      const gaiaSurcharge = new Reward(2, Resource.Qic);
      expect(player.gaiaFormingCost()).to.deep.equal(gaiaSurcharge);

      const gaiaHex = findUnoccupiedHexOfPlanet(engine, Planet.Gaia);
      expect(gaiaHex, "need an unoccupied Gaia hex").to.not.equal(undefined);

      const [rangeCommand] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
        federation: SpaceshipFederation.Range,
      });
      const rangeBuilding = rangeCommand.data.buildings.find((b) => b.coordinates === gaiaHex.toString());
      expect(rangeBuilding, "Range should still allow building on Gaia planets").to.not.equal(undefined);
      expect(rangeBuilding.cost).to.equal(Reward.toString([gaiaSurcharge]));

      const rangeQic = qicForDistance(engine.map, gaiaHex, player, engine.replay)?.amount ?? 0;
      const [terraformCommand] = possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, {
        federation: SpaceshipFederation.Terraform,
      });
      const terraformBuilding = terraformCommand.data.buildings.find((b) => b.coordinates === gaiaHex.toString());
      expect(terraformBuilding, "Terraform should still allow building on Gaia planets").to.not.equal(undefined);
      expect(terraformBuilding.cost).to.equal(
        Reward.toString(Reward.merge([gaiaSurcharge, new Reward(rangeQic, Resource.Qic)]))
      );
    });
  });

  it("returns nothing once the mine limit is reached", () => {
    const engine = createLostFleetRoundMoveEngine(2);
    const player = engine.player(PlayerEnum.Player1);
    player.data.buildings[Building.Mine] = player.maxBuildings(Building.Mine);

    expect(
      possibleFederationTokenBuildMine(engine, PlayerEnum.Player1, { federation: SpaceshipFederation.Range })
    ).to.deep.equal([]);
  });
});
