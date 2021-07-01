import { AvailableResearchTrack } from "../available-command";
import Engine from "../engine";
import { Building, Faction } from "../enums";
import Player from "../player";
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
    handlers: {
      modifyResearchAreas: (
        thisPlayer: Player,
        tracks: AvailableResearchTrack[],
        engine: Engine,
        cost: string,
        data?: any
      ) => {
        if (data?.bescods) {
          // up-lowest
          const minArea = Math.min(...tracks.map((track) => thisPlayer.data.research[track.field]));
          const lowestTracks = tracks.filter((track) => thisPlayer.data.research[track.field] === minArea);
          Object.assign(tracks, lowestTracks);
          tracks.length = lowestTracks.length;
        }
      },
    },
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["2k,4o,15c,q", "+o", "=> up-lowest"],
      },
    },
  ],
};

export default bescods;
