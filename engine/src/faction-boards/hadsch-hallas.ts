import { ConversionPool, freeActionsHadschHallas } from "../actions";
import { Faction } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const hadschHallas: FactionBoardVariants = {
  faction: Faction.HadschHallas,
  standard: {
    income: ["3k,4o,15c,q,up-eco", "+o,k,3c"],
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => {
        if (player.data.hasPlanetaryInstitute()) {
          pool.push(freeActionsHadschHallas, player);
        }
      },
    },
  },
  variants: [
    {
      type: "beta",
      board: {
        income: ["3k,4o,15c,q,up-eco,up-eco", "+o,k,3c"],
      },
    },
  ],
};

export default hadschHallas;
