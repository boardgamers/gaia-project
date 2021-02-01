import { FactionBoardRaw } from ".";
import Player from "../player";
import { GaiaHex } from "../gaia-hex";
import Reward from "../reward";
import { Building, Faction } from "../enums";

const geodens: FactionBoardRaw = {
  faction: Faction.Geodens,
  income: ["3k,4o,15c,q,up-terra", "+o,k"],
  handlers: {
    [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => {
      if (!player.data.hasPlanetaryInstitute()) {
        return;
      }
      for (const hex2 of player.data.occupied) {
        if (hex !== hex2 && hex2.data.planet === hex.data.planet) {
          return;
        }
      }

      player.gainRewards([new Reward("3k")], Faction.Geodens);
    },
  },
};

export default geodens;
