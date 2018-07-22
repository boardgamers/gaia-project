import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const firaks: FactionBoardRaw = {
  buildings: {
    [Building.PlanetaryInstitute]: {
      income: [["+4pw", "+t", "=> down-lab"]]
    }
  },
  income: ["2k,3o,15c,q", "+o,2k"]
};

export default firaks;
