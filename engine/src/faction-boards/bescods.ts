import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const bescods: FactionBoardVariants = {
  standard: {
    faction: Faction.Bescods,
    buildings: {
      [Building.TradingStation]: {
        income: [["+k"], ["+k"], ["+k"], ["+k"]],
      },
      [Building.ResearchLab]: {
        income: [
          ["+3c", "tech"],
          ["+4c", "tech"],
          ["+5c", "tech"],
        ],
      },
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+2t"]],
      },
    },
    income: ["k,4o,15c,q", "+o", "=> up-lowest"],
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["2k,4o,15c,q", "+o", "=> up-lowest"],
      },
    },
    {
      type: "beta",
      board: {
        income: ["k,4o,15c,q,up-sci", "+o", "=> up-lowest"],
      },
    },
  ],
};

export default bescods;
