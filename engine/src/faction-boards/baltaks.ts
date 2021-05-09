import { ConversionPool } from "../actions";
import { Building, Faction, freeActionsBaltaks } from "../enums";
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
      freeActionChoice: (player: Player, pool: ConversionPool) => pool.push(freeActionsBaltaks, player),
    },
  },
};

export default baltaks;
