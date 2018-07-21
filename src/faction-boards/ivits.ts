import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const ivits: FactionBoardRaw = {
  buildings: {
    [Building.PlanetaryInstitute]: {
      cost: "~",
      income: [["+4pw", "+t", "=> space-station"]]
    }
  },
  income: ["3k,4o,15c,q", "+o,k,q"]
};

export default ivits;
