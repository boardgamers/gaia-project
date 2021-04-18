import { Faction, Planet } from "./enums";

const factions: { [key in Faction]: { name: string; planet: Planet } } = {
  [Faction.Terrans]: {
    name: "Terrans",
    planet: Planet.Terra,
  },
  [Faction.Lantids]: {
    name: "Lantids",
    planet: Planet.Terra,
  },
  [Faction.Xenos]: {
    name: "Xenos",
    planet: Planet.Desert,
  },
  [Faction.Gleens]: {
    name: "Gleens",
    planet: Planet.Desert,
  },
  [Faction.Taklons]: {
    name: "Taklons",
    planet: Planet.Swamp,
  },
  [Faction.Ambas]: {
    name: "Ambas",
    planet: Planet.Swamp,
  },
  [Faction.HadschHallas]: {
    name: "Hadsch Hallas",
    planet: Planet.Oxide,
  },
  [Faction.Ivits]: {
    name: "Ivits",
    planet: Planet.Oxide,
  },
  [Faction.Geodens]: {
    name: "Geoden",
    planet: Planet.Volcanic,
  },
  [Faction.BalTaks]: {
    name: "Bal T'aks",
    planet: Planet.Volcanic,
  },
  [Faction.Firaks]: {
    name: "Firaks",
    planet: Planet.Titanium,
  },
  [Faction.Bescods]: {
    name: "Bescods",
    planet: Planet.Titanium,
  },
  [Faction.Nevlas]: {
    name: "Nevlas",
    planet: Planet.Ice,
  },
  [Faction.Itars]: {
    name: "Itars",
    planet: Planet.Ice,
  },
} as const;

export function oppositeFaction(faction: Faction): Faction {
  if (!Object.values(Faction).includes(faction)) {
    return null;
  }

  for (const fct of Object.values(Faction)) {
    if (fct !== faction && factions[fct].planet === factions[faction].planet) {
      return fct;
    }
  }
}

export function factionPlanet(faction: Faction): Planet {
  const fact = factions[faction];

  if (fact) {
    return fact.planet;
  }
  return Planet.Lost;
}

export default factions;
