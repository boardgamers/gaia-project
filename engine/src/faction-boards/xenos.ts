import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const xenos: FactionBoardVariants = {
  faction: Faction.Xenos,
  standard: {
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+q"]],
      },
    },
    income: ["3k,4o,15c,q,up-int", "+o,k"],
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        buildings: {
          [Building.PlanetaryInstitute]: {
            income: [["+4pw", "+q", "+t"]],
          },
        },
      },
    },
    {
      type: "beta",
      board: {
        income: ["3k,4o,15c,q,up-int,up-int", "+o,k"],
      },
    },
  ],
};

export default xenos;
