import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const firaks: FactionBoardVariants = {
  faction: Faction.Firaks,
  standard: {
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+t", "=> down-lab"]],
      },
    },
    income: ["2k,3o,15c,q", "+o,2k"],
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["2k,4o,15c,q", "+o,2k"],
        power: {
          area1: 4,
          area2: 2,
        },
      },
      version: 0,
    },
    {
      type: "beta",
      version: 0,
      board: {
        income: ["2k,3o,15c,q,up-sci", "+o,2k"],
      },
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["2k,3o,15c,q,up-eco", "+o,2k"],
      },
    },
  ],
};

export default firaks;
