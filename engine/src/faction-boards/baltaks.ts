import { freeActionsBaltaks } from "../actions";
import { Building, Faction } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const baltaks: FactionBoardVariants = {
  standard: {
    faction: Faction.BalTaks,
    buildings: {
      [Building.Academy2]: {
        cost: "6c,6o",
        income: [["=>4c", "tech"]],
      },
    },
    income: ["3k,4o,15c,up-gaia", "+o,k"],
    power: {
      area2: 2,
    },
    handlers: {
      freeActionChoice: (player: Player, pool: any[]) => pool.push(...freeActionsBaltaks),
    },
  },
};

export default baltaks;
