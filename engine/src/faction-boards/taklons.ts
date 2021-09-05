import { ConversionPool, freeActionsTaklons } from "../actions";
import { Faction, PowerArea } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const taklons: FactionBoardVariants = {
  faction: Faction.Taklons,
  standard: {
    brainstone: PowerArea.Area1,
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => pool.push(freeActionsTaklons, player),
    },
  },
};

export default taklons;
