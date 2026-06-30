import { Faction } from "../enums";
import { FactionBoardVariants } from "./types";

const tinkeroids: FactionBoardVariants = {
  faction: Faction.Tinkeroids,
  standard: {
    income: ["2k,4o,15c,q,up-sci", "+o,k"],
    power: {
      area1: 4,
      area2: 2,
    },
  },
};

export default tinkeroids;
