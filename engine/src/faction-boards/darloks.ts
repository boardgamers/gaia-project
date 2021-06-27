import { PlayerEnum } from "../..";
import { Building, Command, Faction, TechTilePos } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const darloks: FactionBoardVariants = {
  standard: {
    faction: Faction.Darloks,
    buildings: {
      [Building.PlanetaryInstitute]: {
        income: [["+4pw", "+t", Command.SpyAdvancedTech]],
      },
    },
    income: ["3k,4o,15c,q", "+o,k", `=> ${Command.SpyTech}`],
    handlers: {
      techTileCovered: (thisPlayer: Player, tile: TechTilePos, coveringPlayer: PlayerEnum) => {
        const spiedTile = thisPlayer.data.tiles.techs.find(tt => tt.pos === tile && tt.owner === coveringPlayer);
        if(spiedTile) {
          thisPlayer.coverTechTile(tile);
        }
      },
    }
  },
};

export default darloks;
