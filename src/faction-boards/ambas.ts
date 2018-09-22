import { Building, Faction } from "../enums";
import { FactionBoardRaw } from ".";

const ambas: FactionBoardRaw = {
  faction: Faction.Ambas,
  buildings: {
    [Building.PlanetaryInstitute]: {
      income: [["+4pw", "+2t", "=> swap-PI"]]
    }
  },
  income: ["3k,4o,15c,q,up-nav", "+2o,k"]
};

export default ambas;
