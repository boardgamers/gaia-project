import Engine from "../engine";
import { AdvTechTilePos, Command, Player, ResearchField, TechTilePos } from "../enums";
import PlayerObject from "../player";
import PlayerData from "../player-data";
import * as researchTracks from "../research-tracks";
import Reward from "../reward";
import { isAdvanced } from "../tiles/techs";
import { AvailableResearchData, AvailableResearchTrack, Offer, UPGRADE_RESEARCH_COST } from "./types";

export function canResearchField(engine: Engine, player: PlayerObject, field: ResearchField): boolean {
  const destTile = player.data.research[field] + 1;
  if (destTile === researchTracks.lastTile(field) && engine.players.some((p) => p.data.research[field] === destTile)) {
    return false;
  }

  return player.canUpgradeResearch(field);
}

export function possibleResearchAreas(engine: Engine, player: Player, cost?: string, data?: any) {
  const commands = [];
  const tracks: AvailableResearchTrack[] = [];
  const pl = engine.player(player);
  const fields = ResearchField.values(engine.expansions);

  if (pl.data.canPay(Reward.parse(cost))) {
    let avFields: ResearchField[] = fields;

    if (data) {
      if (data.bescods) {
        const minArea = Math.min(...fields.map((field) => pl.data.research[field]));
        avFields = fields.filter((field) => pl.data.research[field] === minArea);
      } else if (data.pos) {
        avFields = [data.pos];
      }
    }

    for (const field of avFields) {
      if (canResearchField(engine, pl, field)) {
        tracks.push({
          field,
          to: pl.data.research[field] + 1,
          cost,
        });
      }
    }
  }

  if (tracks.length > 0) {
    commands.push({
      name: Command.UpgradeResearch,
      player,
      data: { tracks } as AvailableResearchData,
    });
  }

  // decline not for main action
  if (cost !== UPGRADE_RESEARCH_COST) {
    commands.push({
      name: Command.Decline,
      player,
      data: { offers: [new Offer(Command.UpgradeResearch, null)] },
    });
  }
  return commands;
}

export function possibleCoverTechTiles(engine: Engine, player: Player) {
  const commands = [];

  const tiles = engine.player(player).data.tiles.techs.filter((tl) => tl.enabled && !isAdvanced(tl.pos));
  commands.push({
    name: Command.ChooseCoverTechTile,
    player,
    data: { tiles },
  });

  return commands;
}

export function canTakeAdvancedTechTile(engine: Engine, data: PlayerData, tilePos: AdvTechTilePos): boolean {
  if (engine.tiles.techs[tilePos].count <= 0) {
    return false;
  }
  if (!data.hasGreenFederation()) {
    return false;
  }
  if (data.research[tilePos.slice("adv-".length)] < 4) {
    return false;
  }
  if (!data.tiles.techs.some((tech) => tech.enabled && !isAdvanced(tech.pos))) {
    return false;
  }
  return true;
}

export function possibleTechTiles(engine: Engine, player: Player) {
  const commands = [];
  const tiles = [];
  const data = engine.players[player].data;

  //  tech tiles that player doesn't already have
  for (const tilePos of TechTilePos.values(engine.expansions)) {
    if (!data.tiles.techs.find((tech) => tech.tile === engine.tiles.techs[tilePos].tile)) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos,
      });
    }
  }

  // adv tech tiles where player has lev 4/5, free federation tokens,
  // and available std tech tiles to cover
  for (const tilePos of AdvTechTilePos.values(engine.expansions)) {
    if (canTakeAdvancedTechTile(engine, data, tilePos)) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos,
      });
    }
  }
  if (tiles.length > 0) {
    commands.push({
      name: Command.ChooseTechTile,
      player,
      data: { tiles },
    });
  }

  return commands;
}
