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
import { buildingsSourceFactory } from "./buildings";
import { leechSourceFactory, powerChargeSourceFactory } from "./charge";
import { ChartFactory } from "./chart-factory";
import { ChartFamily, ChartSource, DatasetFactory, getDataPoints, IncludeRounds, playerLabel } from "./charts";
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
  tradeResourceSourceFactory,
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
    resourceSourceFactory,
    powerChargeSourceFactory,
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
  ];
  if (expansion == Expansion.Frontiers) {
    s.push(tradeResourceSourceFactory);
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

export const simpleChartFactory = (
  simpleSourceFactory: <Source extends ChartSource<any>>(family: ChartFamily) => SimpleSourceFactory<Source>
): ChartFactory<ChartSource<any>> => ({
  includeRounds: "except-final",

  sources(family: ChartFamily): ChartSource<any>[] {
    return simpleSourceFactory(family).sources;
  },
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: ChartSource<any>[],
    includeRounds: IncludeRounds,
    family: ChartFamily
  ) {
    return simpleChartDetails(simpleSourceFactory(family), data, player, sources, includeRounds);
  },
  singlePlayerSummaryTitle(player: Player, family: ChartFamily): string {
    return `${simpleSourceFactory(family).name} of ${playerLabel(player)}`;
  },
  playerSummaryTitle(family: ChartFamily): string {
    const sourceFactory = simpleSourceFactory(family);
    return sourceFactory.playerSummaryLineChartTitle;
  },
  kindBreakdownTitle(family: ChartFamily, source: ChartSource<any>): string {
    return `${source.label} of all players`;
  },
  stacked() {
    return false;
  },
  showWeightedTotal(family: ChartFamily): boolean {
    return simpleSourceFactory(family).showWeightedTotal;
  },
});

export const simpleChartFactoryEntries = (sourceFactories: SimpleSourceFactory<ChartSource<any>>[]) => {
  function simpleSourceFactory<Source extends ChartSource<any>>(family: ChartFamily): SimpleSourceFactory<Source> {
    return sourceFactories.find((f) => f.name == family) as SimpleSourceFactory<Source>;
  }

  const scf = simpleChartFactory(simpleSourceFactory);

  return sourceFactories.map((value) => [value.name, scf] as [ChartFamily, ChartFactory<any>]);
};
