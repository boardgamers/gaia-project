import { ConversionPool, freeActionsXenos } from "../actions";
import { Building, Expansion, Faction, hasExpansion } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const xenos: FactionBoardVariants = {
  faction: Faction.Xenos,
  standard: {
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+q"]],
      },
    },
    income: ["3k,4o,15c,q,up-int", "+o,k"],
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => {
        if (hasExpansion(player.expansions, Expansion.LostFleet)) {
          pool.push(freeActionsXenos, player);
        }
      },
    },
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        buildings: {
          [Building.PlanetaryInstitute]: {
            income: [["+4pw", "+q", "+t"]],
          },
        },
      },
      version: 0,
    },
    {
      type: "beta",
      board: {
        income: ["3k,4o,15c,q,up-int,up-int", "+o,k"],
      },
      version: 0,
    },
  ],
};

export default xenos;
