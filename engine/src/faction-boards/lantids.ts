import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const lantids: FactionBoardVariants = {
  faction: Faction.Lantids,
  standard: {
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw"]],
      },
    },
    income: ["3k,4o,13c,q", "+o,k"],
    power: {
      area1: 4,
      area2: 0,
    },
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,4o,15c,q", "+o,k"],
        power: {
          area1: 4,
          area2: 2,
        },
      },
      version: 0,
    },
    {
      type: "beta",
      board: {
        income: ["3k,4o,13c,q,up-eco,up-eco", "+o,k"],
      },
      version: 0,
    },
  ],
};

export default lantids;
