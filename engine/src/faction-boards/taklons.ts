import { ConversionPool } from "../actions";
import { Faction, freeActionsTaklons, PowerArea } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const taklons: FactionBoardVariants = {
  standard: {
    faction: Faction.Taklons,
    brainstone: PowerArea.Area1,
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => pool.push(freeActionsTaklons, player),
    },
  },
};

export default taklons;
