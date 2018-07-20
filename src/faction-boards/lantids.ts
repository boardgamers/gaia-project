import { Building } from "../enums";
import { FactionBoardRaw } from ".";

const lantids: FactionBoardRaw = {
  [Building.PlanetaryInstitute]: {
    income: [["+4pw"]]
  },
  income: ["3k,4o,13c,q", "+o,k"],
  power: {
    area1: 4,
    area2: 0
  }
};

export default lantids;
