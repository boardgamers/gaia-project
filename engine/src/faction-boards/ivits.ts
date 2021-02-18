import { FactionBoardRaw } from ".";
import { Building, Faction } from "../enums";

const ivits: FactionBoardRaw = {
  faction: Faction.Ivits,
  buildings: {
    [Building.PlanetaryInstitute]: {
      cost: "~",
      income: [["+4pw", "+t", "=> space-station"]],
    },
  },
  income: ["3k,4o,15c,q", "+o,k,q"],
};

export default ivits;
