import { Building, Faction } from "../enums";
import { GaiaHex } from "../gaia-hex";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

const geodens: FactionBoardVariants = {
  standard: {
    faction: Faction.Geodens,
    income: ["3k,4o,15c,q,up-terra", "+o,k"],
    handlers: {
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => {
        if (player.data.hasPlanetaryInstitute() && player.data.isNewPlanetType(hex)) {
          player.gainRewards([new Reward("3k")], Faction.Geodens);
        }
      },
    },
  },
};

export default geodens;
