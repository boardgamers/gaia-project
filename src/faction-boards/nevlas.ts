import { FactionBoardRaw } from ".";
import { Building } from "../enums";
import Player from "../player";

const nevlas: FactionBoardRaw = {
  [Building.TradingStation]: {
    income: [["+3c"], ["+4c"], ["+4c"], ["+5c"]],
  },
  [Building.ResearchLab]: {
    income: [["+2pw", "tech"], ["+2pw", "tech"], ["+2pw", "tech"]]
  },
  income: ["2k,4o,15c,q,up-sci", "+o,k"],
  handlers: {
    'planetary-institute': (player: Player) => player.data.tokenModifier = 2
  }
};

export default nevlas;
