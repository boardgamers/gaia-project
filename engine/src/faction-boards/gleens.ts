import { Building, Faction, Federation, Planet } from "../enums";
import { GaiaHex } from "../gaia-hex";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

function gaiaVp(hex: GaiaHex, player: Player) {
  if (hex.data.planet === Planet.Gaia) {
    player.gainRewards([new Reward("2vp")], Faction.Gleens);
  }
}

const gleens: FactionBoardVariants = {
  faction: Faction.Gleens,
  standard: {
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+o"]],
      },
    },
    income: ["3k,4o,15c,up-nav", "+o,k"],
    handlers: {
      [`build-${Building.PlanetaryInstitute}`]: (player: Player) => player.gainFederationToken(Federation.Gleens),
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => gaiaVp(hex, player),
      [`build-${Building.Colony}`]: (player: Player, hex: GaiaHex) => gaiaVp(hex, player),
    },
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,4o,15c,q,up-nav", "+o,k"],
      },
      version: 0,
    },
    {
      type: "beta",
      version: 0,
      board: {
        income: ["3k,4o,15c,up-nav,up-nav", "+o,k"],
      },
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["3k,4o,15c,up-nav,up-nav,up-nav", "+o,k"],
      },
    },
  ],
};

export default gleens;
