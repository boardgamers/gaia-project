import Engine, {
  AdvTechTile,
  Booster,
  Expansion,
  Faction,
  FinalTile,
  LogEntry,
  Player,
  PlayerEnum,
} from "@gaia-project/engine";
import { resolveColor } from "../../graphics/colors";
import { balanceSheetResources, balanceSheetSourceFactory } from "./balance-sheet";
import { buildingsSourceFactory } from "./buildings";
import { leechSourceFactory } from "./charge";
import { ChartFactory } from "./chart-factory";
import { ChartSource, DatasetFactory, getDataPoints, IncludeRounds, playerLabel } from "./charts";
import { factionSourceFactory } from "./factions";
import { federationsSourceFactory } from "./federations";
import { finalScoringSourceFactory } from "./final-scoring";
import { planetsSourceFactory } from "./plantets";
import { researchSourceFactory } from "./research";
import {
  boardActionSourceFactory,
  boosterSourceFactory,
  freeActionSourceFactory,
  resourceSourceFactory,
  tradeSourceFactory,
} from "./resources";
import { ExtractLog, logEntryProcessor, SimpleSourceFactory } from "./simple-charts";
import { advancedTechSourceFactory, baseTechSourceFactory } from "./tech";
import { terraformingStepsSourceFactory } from "./terraforming";

export const createSimpleSourceFactories = (
  advTechTiles: Map<AdvTechTile, string>,
  boosters: Booster[],
  finalTiles: FinalTile[],
  factions: Faction[],
  expansion: Expansion
): SimpleSourceFactory<ChartSource<any>>[] => {
  const s = [
    resourceSourceFactory(expansion),
    leechSourceFactory,
    factionSourceFactory(factions),
    freeActionSourceFactory,
    boardActionSourceFactory,
    buildingsSourceFactory(expansion),
    researchSourceFactory(expansion),
    planetsSourceFactory,
    terraformingStepsSourceFactory,
    boosterSourceFactory(boosters),
    federationsSourceFactory(expansion),
    baseTechSourceFactory(expansion),
    advancedTechSourceFactory(advTechTiles),
    finalScoringSourceFactory(finalTiles),
  ].concat(balanceSheetResources.map((r) => balanceSheetSourceFactory(r, expansion)));
  if (expansion == Expansion.Frontiers) {
    s.push(tradeSourceFactory(expansion));
  }
  return s;
};

function simpleChartDetails<Source extends ChartSource<any>>(
  factory: SimpleSourceFactory<Source>,
  data: Engine,
  player: PlayerEnum,
  sources: Source[],
  includeRounds: IncludeRounds
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }

  function makeExtractLog(
    s: Source,
    extract: ExtractLog<Source> | null
  ): (moveHistory: string[], log: LogEntry) => number {
    if (!extract) {
      return () => 0;
    }
    const processor = extract.processor(pl, s, data);

    return logEntryProcessor((cmd, log, allCommands, cmdIndex) =>
      processor({
        cmd,
        allCommands,
        cmdIndex,
        source: s,
        data,
        log,
      })
    );
  }

  return sources.map((s) => {
    const initialValue = factory.initialValue?.(pl, s) ?? 0;
    const extractChange = factory.extractChange?.(pl, s) ?? (() => 0);
    const extractLog = makeExtractLog(s, factory.extractLog);

    return {
      backgroundColor: resolveColor(s.color, pl),
      label: s.label,
      description: "",
      fill: false,
      getDataPoints: () => getDataPoints(data, initialValue, extractChange, extractLog, null, includeRounds),
      weight: s.weight,
    };
  });
}

export function simpleChartFactory(simpleSourceFactory: SimpleSourceFactory<any>): ChartFactory<ChartSource<any>> {
  return {
    type: simpleSourceFactory.name,
    group: simpleSourceFactory.group,
    includeRounds: "except-final",
    sources: simpleSourceFactory.sources,
    newDetails(data: Engine, player: PlayerEnum, sources: ChartSource<any>[], includeRounds: IncludeRounds) {
      return simpleChartDetails(simpleSourceFactory, data, player, sources, includeRounds);
    },
    singlePlayerSummaryTitle(player: Player): string {
      return `${simpleSourceFactory.name} of ${playerLabel(player)}`;
    },
    playerSummaryTitle: simpleSourceFactory.playerSummaryLineChartTitle,
    kindBreakdownTitle(source: ChartSource<any>): string {
      return `${source.label} of all players`;
    },
    stacked() {
      return false;
    },
    summary: simpleSourceFactory.summary,
  };
}
