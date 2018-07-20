import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const itars: FactionBoardRaw = {
  [Building.Academy1]: {
    income: [["+3k", "tech"]]
  },
  income: ["3k,5o,15c,q", "+o,k,t"],
  power: {
    area1: 4
  },
  handlers: {
    burn: (player, amount) => player.data.power.gaia += amount
  }
};

export default itars;
