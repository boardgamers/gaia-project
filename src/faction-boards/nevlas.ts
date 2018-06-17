import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const nevlas: FactionBoardRaw = {
  [Building.TradingStation]: {
    income: ["+3c","+4c","+4c","+5c"],
  },
  [Building.ResearchLab]: {
    income: ["+2pw","+2pw","+2pw"]
  },
  income: ["2k,4o,15c,q,up-sci", "+o,k"]
};

export default nevlas;