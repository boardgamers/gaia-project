import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const firaks: FactionBoardVariants = {
  standard: {
    faction: Faction.Firaks,
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
    },
    {
      type: "beta",
      board: {
        income: ["2k,3o,15c,q,up-sci", "+o,2k"],
      },
    },
  ],
};

export default firaks;
