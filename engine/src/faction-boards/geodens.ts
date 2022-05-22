import { Building, Faction } from "../enums";
import { GaiaHex } from "../gaia-hex";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

function gainExtraKnowledge(player: Player, hex: GaiaHex) {
  if (player.data.hasPlanetaryInstitute() && player.data.isNewPlanetType(hex)) {
    player.gainRewards([new Reward("3k")], Faction.Geodens);
  }
}

const geodens: FactionBoardVariants = {
  faction: Faction.Geodens,
  standard: {
    income: ["3k,4o,15c,q,up-terra", "+o,k"],
    handlers: {
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => gainExtraKnowledge(player, hex),
      [`build-${Building.Colony}`]: (player: Player, hex: GaiaHex) => gainExtraKnowledge(player, hex),
    },
  },
  variants: [
    {
      type: "beta",
      version: 0,
      board: {
        income: ["3k,4o,15c,q,up-terra,up-terra", "+o,k"],
      },
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["5k,4o,15c,q,up-terra,up-terra", "+o,k"],
      },
    },
  ],
};

export default geodens;
