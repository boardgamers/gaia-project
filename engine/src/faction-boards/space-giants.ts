import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const spaceGiants: FactionBoardVariants = {
  faction: Faction.SpaceGiants,
  standard: {
    // Exploration board special action: once per round, Build a Mine with 2 free terraforming
    // steps (extra ore still owed for any step beyond that) - reuses the same temporaryStep
    // discount mechanism as the "step" round booster.
    income: ["3k,6o,15c,q,up-nav", "+o,k", "=> 2step"],
    power: {
      area1: 4,
      area2: 4,
    },
    buildings: {
      [Building.PlanetaryInstitute]: {
        // standard +4pw income buffed to +6pw, plus an immediate tech tile of choice (once only)
        income: [["+6pw", "+t", "tech"]],
      },
    },
  },
};

export default spaceGiants;
