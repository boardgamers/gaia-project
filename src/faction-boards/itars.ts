import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const itars: FactionBoardRaw = {
  [Building.Academy1]: {
    income: ["+3k"]
  },
  [Building.Academy2]: {
    income: ["=>q"]
  },
  income: ["3k,5o,15c,q", "+o,k,t"]
};

export default itars;