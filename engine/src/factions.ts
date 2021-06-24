import { difference } from "lodash";
import { Faction, Planet } from "./enums";

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
} as const;

function oppositeFaction(faction: Faction): Faction {
  if (!Object.values(Faction).includes(faction)) {
    return null;
  }

  for (const fct of Object.values(Faction)) {
    if (fct !== faction && factions[fct].planet === factions[faction].planet) {
      return fct;
    }
  }
}

export function remainingFactions(chosenFactions: Faction[]) {
  return difference(
    Object.values(Faction),
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
