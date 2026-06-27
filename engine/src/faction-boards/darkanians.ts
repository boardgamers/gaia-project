import { Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const darkanians: FactionBoardVariants = {
  faction: Faction.Darkanians,
  standard: {
    income: ["3k,7o,15c,q,up-nav,up-eco", "+o,k"],
    power: {
      area1: 4,
      area2: 2,
    },
  },
};

export default darkanians;
