import { ConversionPool, freeActionsNevlas, freeActionsNevlasPI } from "../actions";
import { Building, Faction } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const nevlas: FactionBoardVariants = {
  standard: {
    faction: Faction.Nevlas,
    buildings: {
      [Building.TradingStation]: {
        income: [["+3c"], ["+4c"], ["+4c"], ["+5c"]],
      },
      [Building.ResearchLab]: {
        income: [
          ["+2pw", "tech"],
          ["+2pw", "tech"],
          ["+2pw", "tech"],
        ],
      },
    },
    income: ["2k,4o,15c,q,up-sci", "+o,k"],
    handlers: {
      [`build-${Building.PlanetaryInstitute}`]: (player: Player) => (player.data.tokenModifier = 2),
      freeActionChoice: (player: Player, pool: ConversionPool) => {
        pool.push(freeActionsNevlas);
        if (player.data.hasPlanetaryInstitute()) {
          pool.push(freeActionsNevlasPI);
        }
      },
    },
  },
};

export default nevlas;
