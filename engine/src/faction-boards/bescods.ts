import { Building, Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const bescods: FactionBoardVariants = {
  faction: Faction.Bescods,
  standard: {
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
      version: 0,
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["k,4o,15c,q,up-sci,up-sci", "+o", "=> up-lowest"],
      },
    },
  ],
};

export default bescods;
