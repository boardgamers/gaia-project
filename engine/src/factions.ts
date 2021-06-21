import { difference } from "lodash";
import { Expansion, Faction, Planet } from "./enums";

type FactionList = { [key: string]: { planet: Planet } };

export const baseFactions: FactionList = {
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

const mooFactions: FactionList = {
  [Faction.Darloks]: {
    planet: Planet.Titanium,
  },
};

const allFactions = { ...baseFactions, ...mooFactions };

function factionsInPlay(expansions: Expansion): FactionList {
  if (expansions === Expansion.MasterOfOrion) {
    return allFactions;
  }
  return baseFactions;
}

function names(factions: FactionList) {
  return Object.keys(factions) as Faction[];
}

function oppositeFaction(faction: Faction, expansions: Expansion): Faction[] {
  const availableFactions = factionsInPlay(expansions);
  const factionNames = names(availableFactions);

  if (!factionNames.includes(faction)) {
    return null;
  }

  return factionNames.filter(
    (fct: Faction) => fct !== faction && availableFactions[fct].planet === availableFactions[faction].planet
  );
}

export function remainingFactions(chosenFactions: Faction[], expansions: Expansion): Faction[] {
  return difference(
    names(factionsInPlay(expansions)),
    chosenFactions,
    chosenFactions.flatMap((f) => oppositeFaction(f, expansions))
  );
}

export function factionPlanet(faction: Faction): Planet {
  const fact = allFactions[faction];
  if (fact) {
    return fact.planet;
  }
  return Planet.Lost;
}
