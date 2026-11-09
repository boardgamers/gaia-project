import { AdvTechTile, Command, Expansion, Spaceship, SpaceshipTechTile, TechTile } from "@gaia-project/engine";
import type { AnyTechTile, AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { advancedTechTileData, techTileData } from "../../data/tech-tiles";
import { ChartSource } from "./charts";
import type { SimpleSourceFactory } from "./simple-charts";
import { ChartSummary, ExtractLog } from "./simple-charts";

const techTileExtractLog: ExtractLog<ChartSource<AnyTechTile | SpaceshipTechTile>> = ExtractLog.filterPlayer((e) => {
  if (e.cmd.command == Command.ChooseTechTile) {
    const pos = e.cmd.args[0] as AnyTechTilePos | Spaceship;
    // Ship supplies disappear when exhausted. Claimed tiles retain their position,
    // even when covered, so they are the authoritative fallback for old moves.
    const tile =
      e.data.tiles.techs[pos]?.tile ??
      e.data.tiles.spaceshipTechs?.[pos as Spaceship]?.tile ??
      e.data.players.flatMap((p) => p.data.tiles.techs).find((t) => t.pos === pos)?.tile;

    if (tile == e.source.type) {
      return 1;
    }
  }
  return 0;
});

export const baseTechSourceFactory = (
  expansion: Expansion
): SimpleSourceFactory<ChartSource<TechTile | SpaceshipTechTile>> => {
  return {
    name: "Base Tech Tiles",
    summary: ChartSummary.total,
    playerSummaryLineChartTitle: "Base Tech tiles of all players",
    extractLog: techTileExtractLog,
    sources: [...TechTile.values(expansion), ...SpaceshipTechTile.values(expansion)].map((t) => ({
      type: t,
      label: techTileData(t).name,
      color: techTileData(t).color,
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
