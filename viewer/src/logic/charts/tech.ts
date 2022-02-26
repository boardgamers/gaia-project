import { AdvTechTile, Command, Expansion, TechTile } from "@gaia-project/engine";
import { AnyTechTile, AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { advancedTechTileData, baseTechTileData } from "../../data/tech-tiles";
import { ChartSource } from "./charts";
import { ChartSummary, ExtractLog, SimpleSourceFactory } from "./simple-charts";

const techTileExtractLog: ExtractLog<ChartSource<AnyTechTile>> = ExtractLog.filterPlayer((e) => {
  if (e.cmd.command == Command.ChooseTechTile) {
    const pos = e.cmd.args[0] as AnyTechTilePos;
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
    summary: ChartSummary.total,
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
  summary: ChartSummary.total,
  playerSummaryLineChartTitle: "Advanced Tech tiles of all players",
  extractLog: techTileExtractLog,
  sources: Array.from(advTechTiles.entries()).map(([tile, color]) => ({
    type: tile,
    label: advancedTechTileData[tile].name,
    color: advancedTechTileData[tile].color,
    weight: 1,
  })),
});
