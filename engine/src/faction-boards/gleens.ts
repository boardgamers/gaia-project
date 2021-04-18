import { Building, Faction, Federation, Planet } from "../enums";
import { GaiaHex } from "../gaia-hex";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

const gleens: FactionBoardVariants = {
  standard: {
    faction: Faction.Gleens,
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+o"]],
      },
    },
    income: ["3k,4o,15c,up-nav", "+o,k"],
    handlers: {
      [`build-${Building.PlanetaryInstitute}`]: (player: Player) => player.gainFederationToken(Federation.Gleens),
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => {
        if (hex.data.planet === Planet.Gaia) {
          player.gainRewards([new Reward("2vp")], Faction.Gleens);
        }
      },
    },
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,4o,15c,q,up-nav", "+o,k"],
      },
    },
  ],
};

export default gleens;
