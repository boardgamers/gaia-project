import Engine from "../engine";
import { Building, Planet, Spaceship, SpaceshipFederation, SpaceshipTechTile } from "../enums";
import { terraformingStepsRequired } from "../planets";
import Player from "../player";

/** Inspectable components of the expert opening-placement prior. */
export interface SetupMinePlacementScore {
  shipAccess: number;
  opponentColorAccess: number;
  gaiaAccess: number;
  asteroidAccess: number;
  oneStepColorAccess: number;
  nearbyPlanetDensity: number;
  total: number;
}

const EMPTY_SETUP_SCORE: SetupMinePlacementScore = {
  shipAccess: 0,
  opponentColorAccess: 0,
  gaiaAccess: 0,
  asteroidAccess: 0,
  oneStepColorAccess: 0,
  nearbyPlanetDensity: 0,
  total: 0,
};

/**
 * The owner-labelled placement horizon: adjacent is best, then distances two and three. Anything
 * farther away is deliberately ignored by this local opening prior.
 */
function proximity(distance: number): number {
  return distance >= 1 && distance <= 3 ? 4 - distance : 0;
}

/**
 * Base values describe the fixed action boards. Seeded tech/federation rewards are then added so
 * the ranking responds to the actual setup rather than treating every spaceship as interchangeable.
 */
function spaceshipOpportunityMultiplier(engine: Engine, ship: Spaceship): number {
  const boardValue: Record<Spaceship, number> = {
    [Spaceship.Twilight]: 1.2,
    [Spaceship.Rebellion]: 1.3,
    [Spaceship.TFMars]: 1.3,
    [Spaceship.Eclipse]: 1.7,
  };
  const techValue: Record<SpaceshipTechTile, number> = {
    [SpaceshipTechTile.Range]: 0.6,
    [SpaceshipTechTile.Terraform]: 0.3,
    [SpaceshipTechTile.Resource]: 0.2,
  };
  const federationValue: Record<SpaceshipFederation, number> = {
    [SpaceshipFederation.Credit]: 0.2,
    [SpaceshipFederation.Knowledge]: 0.2,
    [SpaceshipFederation.OreQic]: 0.2,
    [SpaceshipFederation.PowerTokens]: 0.2,
    [SpaceshipFederation.Range]: 0.2,
    [SpaceshipFederation.Tech]: 0.3,
    [SpaceshipFederation.Terraform]: 0.2,
    [SpaceshipFederation.Vp]: 0.1,
  };
  const tech = engine.tiles.spaceshipTechs[ship]?.tile;
  const federation = engine.tiles.spaceshipFederations[ship];
  return boardValue[ship] + (tech ? techValue[tech] : 0) + (federation ? federationValue[federation] : 0);
}

export function scoreSetupMinePlacement(engine: Engine, player: Player, coordinates: string): SetupMinePlacementScore {
  const origin = engine.map.getS(coordinates);
  if (!origin) {
    return { ...EMPTY_SETUP_SCORE };
  }

  const opponentPlanets = engine.players
    .filter((candidate) => candidate.player !== player.player)
    .map((candidate) => candidate.planet);
  const score = { ...EMPTY_SETUP_SCORE };

  for (const hex of engine.map.grid.values()) {
    const distance = engine.map.distance(origin, hex);
    const closeness = proximity(distance);
    if (closeness === 0) {
      continue;
    }

    const ship = hex.data.spaceship as Spaceship | undefined;
    if (ship) {
      score.shipAccess += closeness * spaceshipOpportunityMultiplier(engine, ship);
    }

    if (!hex.hasPlanet()) {
      continue;
    }
    const planet = hex.data.planet as Planet;
    score.nearbyPlanetDensity += closeness * 0.15;
    if (opponentPlanets.includes(planet)) {
      score.opponentColorAccess += closeness * 1.5 + (distance <= 2 ? 1 : 0);
    }
    if (planet === Planet.Gaia) {
      score.gaiaAccess += closeness * 1.3;
    }
    if (planet === Planet.Asteroid) {
      score.asteroidAccess += closeness * 0.9;
    }
    if (terraformingStepsRequired(player.faction, planet, player.data.lostFleetCost3Planets) === 1) {
      score.oneStepColorAccess += closeness * 0.7;
    }
  }

  score.total =
    score.shipAccess +
    score.opponentColorAccess +
    score.gaiaAccess +
    score.asteroidAccess +
    score.oneStepColorAccess +
    score.nearbyPlanetDensity;
  return score;
}

/** Sum the still-relevant opening value of every setup Mine placed by this player. */
export function scoreSetupPlacements(engine: Engine, player: Player): SetupMinePlacementScore {
  const score = { ...EMPTY_SETUP_SCORE };
  for (const hex of player.data.occupied) {
    if (hex.buildingOf(player.player) !== Building.Mine) {
      continue;
    }
    const placement = scoreSetupMinePlacement(engine, player, hex.toString());
    score.shipAccess += placement.shipAccess;
    score.opponentColorAccess += placement.opponentColorAccess;
    score.gaiaAccess += placement.gaiaAccess;
    score.asteroidAccess += placement.asteroidAccess;
    score.oneStepColorAccess += placement.oneStepColorAccess;
    score.nearbyPlanetDensity += placement.nearbyPlanetDensity;
    score.total += placement.total;
  }
  return score;
}
