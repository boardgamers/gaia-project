import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const moweyds: FactionBoardVariants = {
  faction: Faction.Moweyds,
  standard: {
    income: ["5k,6o,15c,2q,up-gaia", "+o,k"],
    power: {
      area1: 4,
      area2: 4,
    },
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+t", "=> power-ring"]],
      },
    },
  },
};

export default moweyds;
