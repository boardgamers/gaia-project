import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const baltaks: FactionBoardRaw = {
  [Building.Academy1]: {
    cost: "6c,6o",
    income: ["+2k"]
  },
  [Building.Academy2]: {
    cost: "6c,6o",
    income: ["=>4c"]
  },
  income: ["3k,4o,15c,up-gaia", "+o,k"]
};

export default baltaks;