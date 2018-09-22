import { FactionBoardRaw } from ".";
import Player from "../player";
import { freeActionsHadschHallas } from "../actions";
import { Faction } from "../enums";

const hadschHallas: FactionBoardRaw = {
  faction: Faction.HadschHallas,
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
