import { Faction, Planet } from './enums';
import Boards from "./faction-boards";

const factions = {
  [Faction.Terrans]: {
    name: "Terrans",
    planet: Planet.Terra,
    board: Boards[Faction.Terrans]
  },
  [Faction.Lantids]: {
    name: "Lantids",
    planet: Planet.Terra,
    board: Boards[Faction.Lantids]
  },
  [Faction.Xenos]: {
    name: "Xenos",
    planet: Planet.Desert,
    board: Boards[Faction.Xenos]
  },
  [Faction.Gleens]: {
    name: "Gleens",
    planet: Planet.Desert,
    board: Boards[Faction.Gleens]
  },
  [Faction.Taklons]: {
    name: "Taklons",
    planet: Planet.Swamp,
    board: Boards[Faction.Taklons]
  },
  [Faction.Ambas]: {
    name: "Ambas",
    planet: Planet.Swamp,
    board: Boards[Faction.Ambas]
  },
  [Faction.HadschHallas]: {
    name: "Hadsch Hallas",
    planet: Planet.Oxide,
    board: Boards[Faction.HadschHallas]
  },
  [Faction.Ivits]: {
    name: "Ivits",
    planet: Planet.Oxide,
    board: Boards[Faction.Ivits]
  },
  [Faction.Geodens]: {
    name: "Geoden",
    planet: Planet.Volcanic,
    board: Boards[Faction.Geodens]
  },
  [Faction.BalTaks]: {
    name: "Bal T'aks",
    planet: Planet.Volcanic,
    board: Boards[Faction.BalTaks]
  },
  [Faction.Firaks]: {
    name: "Firaks",
    planet: Planet.Titanium,
    board: Boards[Faction.Firaks]
  },
  [Faction.Bescods]: {
    name: "Bescods",
    planet: Planet.Titanium,
    board: Boards[Faction.Bescods]
  },
  [Faction.Nevlas]: {
    name: "Nevlas",
    planet: Planet.Ice,
    board: Boards[Faction.Nevlas]
  },
  [Faction.Itars]: {
    name: "Itars",
    planet: Planet.Ice,
    board: Boards[Faction.Itars]
  },

  opposite(faction: Faction): Faction {
    if (!Object.values(Faction).includes(faction)) {
      return null;
    } 

    for (const fct of Object.values(Faction)) {
      if (fct !== faction && factions[fct].planet === factions[faction].planet) {
        return fct;
      }
    }
  }
};

export default factions;