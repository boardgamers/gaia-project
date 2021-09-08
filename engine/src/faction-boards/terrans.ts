import { Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const terrans: FactionBoardVariants = {
  faction: Faction.Terrans,
  standard: {
    income: ["3k,4o,15c,q,up-gaia", "+o,k"],
    power: {
      area1: 4,
    },
    handlers: {
      discardGaia: (player, amount) => (player.data.power.area2 += amount),
      "gaiaPhase-beforeTokenMove": (player) => {
        player.data.power.area2 += player.data.power.gaia;
        player.data.power.gaia = 0;
      },
    },
  },
  variants: [
    {
      type: "beta",
      version: 0,
      board: {
        income: ["3k,4o,15c,q,up-gaia,up-nav", "+o,k"],
      },
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["3k,4o,15c,q,up-gaia", "+o,k"], //vanilla
      },
    },
  ],
};

export default terrans;
