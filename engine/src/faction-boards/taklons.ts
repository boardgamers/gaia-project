import { ConversionPool, freeActionsTaklons } from "../actions";
import { BrainstoneArea, Faction } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const taklons: FactionBoardVariants = {
  standard: {
    faction: Faction.Taklons,
    brainstone: BrainstoneArea.Area1,
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => pool.push(freeActionsTaklons),
    },
  },
};

export default taklons;
