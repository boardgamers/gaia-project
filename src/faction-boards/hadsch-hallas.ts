import { FactionBoardRaw } from ".";
import { Building } from "../enums";
import Player from "../player";
import { freeActionsHadschHallas } from "../actions";

const hadschHallas: FactionBoardRaw = {
  income: ["3k,4o,15c,q,up-eco", "+o,k,3c"],
  handlers: {
   freeActionChoice: (player: Player, pool: any[]) => {
    if (player.data.hasPlanetaryInstitute()) {
      pool.push(...freeActionsHadschHallas);
    }
   }
  }
};

export default hadschHallas;
