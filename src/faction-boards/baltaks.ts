import { FactionBoardRaw } from ".";
import { Building } from "../enums";
import Player from "../player";
import { freeActionsBaltaks } from "../actions";

const baltaks: FactionBoardRaw = {
  [Building.Academy2]: {
    cost: "6c,6o",
    income: [["=>4c", "tech"]]
  },
  income: ["3k,4o,15c,up-gaia", "+o,k"],
  power: {
    area2: 2
  },
  handlers: {
    freeActionChoice:  (player: Player, pool: any[]) => pool.push(...freeActionsBaltaks)
  }
};

export default baltaks;
