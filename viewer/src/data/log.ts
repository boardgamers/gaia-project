import Engine, { AdvTechTilePos, Command, TechTilePos } from "@gaia-project/engine";
import { boosterNames } from "./boosters";
import { advancedTechTileNames, baseTechTileNames } from "./tech-tiles";

export function createReplace(data: Engine): { from: string; to: string }[] {
  return [
    Object.keys(boosterNames).map((b) => ({
      from: b,
      to: boosterNames[b].name,
    })),
    TechTilePos.values().map((p) => ({
      from: `${Command.ChooseTechTile} ${p}`,
      to: baseTechTileNames[data.tiles.techs[p].tile].name,
    })),
    AdvTechTilePos.values().map((p) => ({
      from: `${Command.ChooseTechTile} ${p}`,
      to: advancedTechTileNames[data.tiles.techs[p].tile],
    })),
  ]
    .flat()
    .map((e) => ({ from: e.from, to: `${e.from} (${e.to})` }));
}
