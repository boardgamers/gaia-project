import Engine from "@gaia-project/engine";
import { boosterNames } from "./boosters";
import { advancedTechTileNames, baseTechTileNames } from "./tech-tiles";

function addDetails(s: string, details: string): string {
  return `${s} (${details})`;
}

export function replaceMove(data: Engine, move: string): string {
  return move.replace(/\btech [a-z0-9-]+|booster[0-9]+/g, (match) => {
    if (match.startsWith("booster")) {
      return addDetails(match, boosterNames[match].name);
    } else {
      const tech = match.substr(5);
      const tile = data.tiles.techs[tech].tile;
      return addDetails(match, tech.startsWith("adv") ? advancedTechTileNames[tile] : baseTechTileNames[tile].name);
    }
  });
}
