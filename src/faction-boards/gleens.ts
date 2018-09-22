import { FactionBoardRaw } from ".";
import { Building, Federation, Faction } from "../enums";
import Player from "../player";

const gleens: FactionBoardRaw = {
  faction: Faction.Gleens,
  buildings: {
    [Building.PlanetaryInstitute]: {
      income: [["+4pw", "+o"]]
    }
  },
  income: ["3k,4o,15c,up-nav", "+o,k", "mg >> 2vp"],
  handlers: {
    [`build-${Building.PlanetaryInstitute}`]: (player: Player) => player.gainFederationToken(Federation.FederationGleens)
  }
};

export default gleens;
