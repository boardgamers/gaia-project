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
        income: ["3k,4o,15c,q", "+o,k"],
        //PI is placed earlier, see beginSetupBuildingPhase
      },
    },
  ],
};

export default ivits;
