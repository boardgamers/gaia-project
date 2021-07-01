import { ConversionPool, freeActionsBaltaks } from "../actions";
import { AvailableResearchTrack } from "../available-command";
import Engine from "../engine";
import { Building, Faction, ResearchField } from "../enums";
import Player from "../player";
import { FactionBoardVariants } from "./types";

const baltaks: FactionBoardVariants = {
  standard: {
    faction: Faction.BalTaks,
    buildings: {
      [Building.Academy2]: {
        cost: "6c,6o",
        income: [["=>4c", "tech"]],
      },
    },
    income: ["3k,4o,15c,up-gaia", "+o,k"],
    power: {
      area2: 2,
    },
    handlers: {
      freeActionChoice: (player: Player, pool: ConversionPool) => pool.push(freeActionsBaltaks, player),
      modifyResearchAreas: (
        thisPlayer: Player,
        tracks: AvailableResearchTrack[],
        engine: Engine,
        cost: string,
        data?: any
      ) => {
        if (!thisPlayer.data.hasPlanetaryInstitute()) {
          for (let i = 0; i < tracks.length; ++i) {
            if (tracks[i].field === ResearchField.Navigation) {
              tracks.splice(i, 1);
              return;
            }
          }
        }
      },
    },
  },
};

export default baltaks;
