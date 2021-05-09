import { ConversionPool } from "../actions";
import { Faction, freeActionsHadschHallas } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const hadschHallas: FactionBoardVariants = {
  standard: {
    faction: Faction.HadschHallas,
    income: ["3k,4o,15c,q,up-eco", "+o,k,3c"],
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => {
        if (player.data.hasPlanetaryInstitute()) {
          pool.push(freeActionsHadschHallas, player);
        }
      },
    },
  },
};

export default hadschHallas;
