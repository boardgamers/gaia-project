import { FactionBoardRaw } from ".";
import { Building, Federation } from "../enums";
import Player from "../player";

const gleens: FactionBoardRaw = {
  [Building.PlanetaryInstitute]: {
    income: [["+4pw", "+o"]]
  },
  income: ["3k,4o,15c", "+o,k", "g >> 2vp"],
  handlers: {
    'planetary-institute': (player: Player) => player.gainFederationToken(Federation.FederationGleens)
  }
};

export default gleens;
