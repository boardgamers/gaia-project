import { Building, Command, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const darloks: FactionBoardVariants = {
  standard: {
    faction: Faction.Darloks,
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+t", Command.SpyAdvancedTech]],
      },
    },
    income: ["3k,4o,15c,q", "+o,k", `=> ${Command.SpyTech}`],
  },
};

export default darloks;
