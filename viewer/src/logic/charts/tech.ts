import {
  AdvTechTile,
  AdvTechTilePos,
  Command,
  Expansion,
  ResearchField,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine";
import { researchColorVar, researchNames } from "../../data/research";
import { advancedTechTileData, baseTechTileData } from "../../data/tech-tiles";
import { ChartSource, initialResearch } from "./charts";
import { commandCounterArg0EqualsSource, ExtractLog, SimpleSourceFactory } from "./simple-charts";

const techTileExtractLog: ExtractLog<ChartSource<TechTile | AdvTechTile>> = ExtractLog.filterPlayer((e) => {
  if (e.cmd.command == Command.ChooseTechTile) {
    const pos = e.cmd.args[0] as TechTilePos | AdvTechTilePos;
    const tile = e.data.tiles.techs[pos].tile;

    if (tile == e.source.type) {
      return 1;
    }
  }
  return 0;
});

export const baseTechSourceFactory = (expansion: Expansion): SimpleSourceFactory<ChartSource<TechTile>> => {
  return {
    name: "Base Tech Tiles",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: "Base Tech tiles of all players",
    extractLog: techTileExtractLog,
    sources: TechTile.values(expansion).map((t) => ({
      type: t,
      label: baseTechTileData[t].name,
      color: baseTechTileData[t].color,
      weight: 1,
    })),
  };
};

export const advancedTechSourceFactory = (
  advTechTiles: Map<AdvTechTile, string>
): SimpleSourceFactory<ChartSource<AdvTechTile>> => ({
  name: "Advanced Tech Tiles",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Advanced Tech tiles of all players",
  extractLog: techTileExtractLog,
  sources: Array.from(advTechTiles.entries()).map(([tile, color]) => ({
    type: tile,
    label: advancedTechTileData[tile].name,
    color: advancedTechTileData[tile].color,
    weight: 1,
  })),
});

export const researchSourceFactory = (expansion: Expansion): SimpleSourceFactory<ChartSource<ResearchField>> => ({
  name: "Research",
  playerSummaryLineChartTitle: "Research steps of all players",
  showWeightedTotal: false,
  initialValue: (player, source) => initialResearch(player).get(source.type) ?? 0,
  extractLog: commandCounterArg0EqualsSource(Command.UpgradeResearch),
  sources: ResearchField.values(expansion).map((field) => {
    return {
      type: field as ResearchField,
      label: researchNames[field],
      color: researchColorVar(field),
      weight: 1,
    };
  }),
});
