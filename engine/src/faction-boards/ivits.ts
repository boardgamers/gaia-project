import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const ivits: FactionBoardVariants = {
  standard: {
    faction: Faction.Ivits,
    buildings: {
      [Building.PlanetaryInstitute]: {
        cost: "~",
        income: [["+4pw", "+t", "=> space-station"]],
      },
    },
    income: ["3k,4o,15c,q", "+o,k,q"],
  },
  variants: [
    {
      type: "more-balanced",
      players: 2,
      board: {
        income: ["3k,4o,15c", "+o,k,q"],
        //PI is placed earlier, see beginSetupBuildingPhase
        buildings: {
          [Building.PlanetaryInstitute]: {
            cost: "~",
            income: [["+4pw", "=> space-station"]],
          },
        },
      },
    },
  ],
};

export default ivits;
