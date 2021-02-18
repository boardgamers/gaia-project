import { FactionBoardRaw } from ".";
import { Building, Faction } from "../enums";

const firaks: FactionBoardRaw = {
  faction: Faction.Firaks,
  buildings: {
    [Building.PlanetaryInstitute]: {
      income: [["+4pw", "+t", "=> down-lab"]],
    },
  },
  income: ["2k,3o,15c,q", "+o,2k"],
};

export default firaks;
