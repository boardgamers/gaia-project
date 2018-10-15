import { FactionBoardRaw } from ".";
import { Building, Federation, Faction, Planet } from "../enums";
import Player from "../player";
import { GaiaHex } from "../gaia-hex";
import Reward from "../reward";

const gleens: FactionBoardRaw = {
  faction: Faction.Gleens,
  buildings: {
    [Building.PlanetaryInstitute]: {
      income: [["+4pw", "+o"]]
    }
  },
  income: ["3k,4o,15c,up-nav", "+o,k"],
  handlers: {
    [`build-${Building.PlanetaryInstitute}`]: (player: Player) => player.gainFederationToken(Federation.Gleens),
    [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => {
      if (hex.data.planet === Planet.Gaia) {
        player.gainRewards([new Reward("2vp")], Faction.Gleens);
      }
    }
  }
};

export default gleens;
