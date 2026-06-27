import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const spaceGiants: FactionBoardVariants = {
  faction: Faction.SpaceGiants,
  standard: {
    income: ["3k,6o,15c,q,up-nav", "+o,k"],
    power: {
      area1: 4,
      area2: 4,
    },
    buildings: {
      [Building.PlanetaryInstitute]: {
        // standard +4pw income buffed to +6pw, plus an immediate tech tile of choice (once only)
        income: [["+6pw", "+t", "tech"]],
      },
    },
  },
};

export default spaceGiants;
