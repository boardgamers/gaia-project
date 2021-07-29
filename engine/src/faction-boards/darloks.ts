import { AvailableResearchTrack, UPGRADE_RESEARCH_COST } from "../available-command";
import Engine from "../engine";
import { Building, Command, Faction, Player as PlayerEnum, ResearchField, TechTilePos } from "../enums";
import Player from "../player";
import { lastTile } from "../research-tracks";
import Reward from "../reward";
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
        const spiedTile = thisPlayer.data.tiles.techs.find((tt) => tt.pos === tile && tt.owner === coveringPlayer);
        if (spiedTile) {
          thisPlayer.coverTechTile(tile);
        }
      },
      modifyResearchAreas: (
        thisPlayer: Player,
        tracks: AvailableResearchTrack[],
        engine: Engine,
        cost: string,
        data?: any
      ) => {
        const STEALTHY_COST = "5k";
        const hasAlreadyJoinedSomeone = ResearchField.values(engine.options.expansion).some(
          (field) => engine.players.filter((p) => p.data.research[field] === lastTile(field)).length === 2
        );
        if (
          cost === UPGRADE_RESEARCH_COST &&
          thisPlayer.data.hasGreenFederation() &&
          thisPlayer.data.canPay(Reward.parse(STEALTHY_COST)) &&
          !hasAlreadyJoinedSomeone
        ) {
          const finalFields = ResearchField.values(engine.options.expansion).filter(
            (field) => thisPlayer.data.research[field] + 1 === lastTile(field) && !tracks.some((t) => t.field === field)
          );
          tracks.push(
            ...finalFields.map((field) => {
              return { field, to: lastTile(field), cost: STEALTHY_COST };
            })
          );
        }
      },
    },
  },
};

export default darloks;
