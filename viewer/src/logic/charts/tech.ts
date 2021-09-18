import { AdvTechTile, AdvTechTilePos, Command, ResearchField, TechTile, TechTilePos } from "@gaia-project/engine";
import { researchNames } from "../../data/research";
import { advancedTechTileNames, baseTechTileNames } from "../../data/tech-tiles";
import { initialResearch } from "./charts";
import { commandCounter, ExtractLog, SimpleSource, SimpleSourceFactory, statelessExtractLog } from "./simple-charts";

const techTileExtractLog: ExtractLog<SimpleSource<TechTile | AdvTechTile>> = statelessExtractLog((e) => {
  if (e.cmd.command == Command.ChooseTechTile) {
    const pos = e.cmd.args[0] as TechTilePos | AdvTechTilePos;
    const tile = e.data.tiles.techs[pos].tile;

    if (tile == e.source.type) {
      return 1;
    }
  }
  return 0;
});

export const baseTechSourceFactory: SimpleSourceFactory<SimpleSource<TechTile>> = {
  name: "Base Tech Tiles",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Base Tech tiles of all players",
  extractLog: techTileExtractLog,
  sources: TechTile.values().map((t) => ({
    type: t,
    label: baseTechTileNames[t].name,
    color: baseTechTileNames[t].color,
    weight: 1,
  })),
};

export const advancedTechSourceFactory = (
  advTechTiles: Map<AdvTechTile, string>
): SimpleSourceFactory<SimpleSource<AdvTechTile>> => ({
  name: "Advanced Tech Tiles",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Advanced Tech tiles of all players",
  extractLog: techTileExtractLog,
  sources: Array.from(advTechTiles.entries()).map(([tile, color]) => ({
    type: tile,
    label: advancedTechTileNames[tile],
    color: color,
    weight: 1,
  })),
});

export const researchSourceFactory: SimpleSourceFactory<SimpleSource<ResearchField>> = {
  name: "Research",
  playerSummaryLineChartTitle: "Research steps of all players",
  showWeightedTotal: false,
  initialValue: (player, source) => initialResearch(player).get(source.type) ?? 0,
  extractLog: commandCounter(Command.UpgradeResearch),
  sources: Object.keys(researchNames).map((field) => {
    return {
      type: field as ResearchField,
      label: researchNames[field],
      color: `--rt-${field}`,
      weight: 1,
    };
  }),
};
