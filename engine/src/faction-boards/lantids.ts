import { Building, Expansion, Faction, hasExpansion, Planet } from "../enums";
import { GaiaHex } from "../gaia-hex";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

// Lost Fleet §I2: in games with fewer than 4 players, Lantids use an adjusted PI tile. The base
// (4-player) "gain 2 knowledge for an additional mine on an already-colonized planet" ability is
// unconditional and already handled directly in player.ts's build() - it's identical on every tile
// side, so it isn't repeated here. This only adds what the adjusted tile changes on top of that:
// solo/2p also grants the same 2 knowledge for any mine built on a Terra hex (their home planet
// type, even a perfectly normal first colonization); 3p additionally charges 1 power for the same
// additional-mine trigger the base tile already covers.
function gainAdjustedPiBonus(player: Player, hex: GaiaHex) {
  if (!hasExpansion(player.expansions, Expansion.LostFleet) || !player.data.hasPlanetaryInstitute()) {
    return;
  }

  if (player.nbPlayers <= 2 && hex.data.planet === Planet.Terra) {
    player.gainRewards(Reward.parse("2k"), Faction.Lantids);
  }

  if (player.nbPlayers === 3 && hex.data.additionalMine === player.player) {
    player.gainRewards(Reward.parse("1pw"), Faction.Lantids);
  }
}

const lantids: FactionBoardVariants = {
  faction: Faction.Lantids,
  standard: {
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw"]],
      },
    },
    income: ["3k,4o,13c,q", "+o,k"],
    power: {
      area1: 4,
      area2: 0,
    },
    handlers: {
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => gainAdjustedPiBonus(player, hex),
    },
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,4o,15c,q", "+o,k"],
        power: {
          area1: 4,
          area2: 2,
        },
      },
      version: 0,
    },
    {
      type: "beta",
      board: {
        income: ["3k,4o,13c,q,up-eco,up-eco", "+o,k"],
      },
      version: 0,
    },
  ],
};

export default lantids;
