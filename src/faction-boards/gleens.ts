import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const gleens: FactionBoardRaw = {
  [Building.PlanetaryInstitute]: {
    income: ["+4pw,o"]
  },
  income: ["3k,4o,15c", "+o,k"]
};

export default gleens;