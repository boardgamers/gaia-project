import { Faction, Resource } from "../enums";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

function terranCharge(player: Player, amount: number) {
  player.gainRewards([new Reward(amount, Resource.ChargePower)], Faction.Terrans);
}

const terrans: FactionBoardVariants = {
  faction: Faction.Terrans,
  standard: {
    income: ["3k,4o,15c,q,up-gaia", "+o,k"],
    power: {
      area1: 4,
    },
    handlers: {
      discardGaia: (player, amount) => {
        terranCharge(player, amount);
      },
      "gaiaPhase-tokensMovedFromGaia": (player, amount) => {
        terranCharge(player, amount);
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
