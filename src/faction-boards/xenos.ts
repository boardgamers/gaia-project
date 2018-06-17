import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const xenos: FactionBoardRaw = {
  [Building.PlanetaryInstitute]: {
    income: ["+4pw,q"]
  },
  income: ["3k,4o,15c,q,up-int", "+o,k"]
};

export default xenos;