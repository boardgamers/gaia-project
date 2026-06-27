import { difference } from "lodash";
import { Expansion, Faction, Planet } from "./enums";

const factions: { [key in Faction]: { planet: Planet } } = {
  [Faction.Terrans]: {
    planet: Planet.Terra,
  },
  [Faction.Lantids]: {
    planet: Planet.Terra,
  },
  [Faction.Xenos]: {
    planet: Planet.Desert,
  },
  [Faction.Gleens]: {
    planet: Planet.Desert,
  },
  [Faction.Taklons]: {
    planet: Planet.Swamp,
  },
  [Faction.Ambas]: {
    planet: Planet.Swamp,
  },
  [Faction.HadschHallas]: {
    planet: Planet.Oxide,
  },
  [Faction.Ivits]: {
    planet: Planet.Oxide,
  },
  [Faction.Geodens]: {
    planet: Planet.Volcanic,
  },
  [Faction.BalTaks]: {
    planet: Planet.Volcanic,
  },
  [Faction.Firaks]: {
    planet: Planet.Titanium,
  },
  [Faction.Bescods]: {
    planet: Planet.Titanium,
  },
  [Faction.Nevlas]: {
    planet: Planet.Ice,
  },
  [Faction.Itars]: {
    planet: Planet.Ice,
  },
  // No home terrain planet (Lost Fleet) - `planet` here only drives the same-color
  // oppositeFaction() exclusivity below, not terraforming (see terraformingStepsRequired()
  // in planets.ts, which special-cases these factions instead of reading factionPlanet()).
  [Faction.Darkanians]: {
    planet: Planet.Asteroid,
  },
  [Faction.SpaceGiants]: {
    planet: Planet.Protoplanet,
  },
} as const;

function oppositeFaction(faction: Faction): Faction {
  const allFactions = Faction.values(Expansion.All);

  if (!allFactions.includes(faction)) {
    return null;
  }

  for (const fct of allFactions) {
    if (fct !== faction && factions[fct].planet === factions[faction].planet) {
      return fct;
    }
  }
}

export function remainingFactions(chosenFactions: Faction[], expansions: Expansion) {
  return difference(
    Faction.values(expansions),
    chosenFactions.map((f) => f),
    chosenFactions.map((f) => oppositeFaction(f))
  );
}

export function factionPlanet(faction: Faction): Planet {
  const fact = factions[faction];

  if (fact) {
    return fact.planet;
  }
  return Planet.Lost;
}
