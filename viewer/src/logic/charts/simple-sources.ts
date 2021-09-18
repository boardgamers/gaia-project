import Engine, { AdvTechTile, Player, PlayerEnum } from "@gaia-project/engine";
import { buildingsSourceFactory } from "./buildings";
import { powerChargeSourceFactory } from "./charge";
import { ChartFactory } from "./chart-factory";
import { ChartFamily, DatasetFactory, getDataPoints, IncludeRounds, playerLabel, resolveColor } from "./charts";
import { federationsSourceFactory } from "./federations";
import { finalScoringSourceFactory } from "./final-scoring";
import { planetsSourceFactory } from "./plantets";
import {
  boardActionSourceFactory,
  boosterSourceFactory,
  freeActionSourceFactory,
  resourceSourceFactory,
} from "./resources";
import { logEntryProcessor, SimpleSource, SimpleSourceFactory } from "./simple-charts";
import { advancedTechSourceFactory, baseTechSourceFactory, researchSourceFactory } from "./tech";
import { terraformingStepsSourceFactory } from "./terraforming";

export const simpleSourceFactories = (
  advTechTiles: Map<AdvTechTile, string>
): SimpleSourceFactory<SimpleSource<any>>[] => {
  return [
    resourceSourceFactory,
    powerChargeSourceFactory,
    freeActionSourceFactory,
    boardActionSourceFactory,
    buildingsSourceFactory,
    researchSourceFactory,
    planetsSourceFactory,
    terraformingStepsSourceFactory,
    boosterSourceFactory,
    federationsSourceFactory,
    baseTechSourceFactory,
    advancedTechSourceFactory(advTechTiles),
    finalScoringSourceFactory,
  ];
};

function simpleChartDetails<Source extends SimpleSource<any>>(
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

  function newExtractLog(s: Source) {
    const e = factory.extractLog(pl);

    return logEntryProcessor((cmd, log, allCommands) =>
      e({
        cmd: cmd,
        allCommands: allCommands,
        source: s,
        data: data,
        log: log,
      })
    );
  }

  return sources.map((s) => {
    const initialValue = factory.initialValue?.(pl, s) ?? 0;
    const extractChange = factory.extractChange?.(pl, s) ?? (() => 0);
    const extractLog = factory.extractLog == null ? () => 0 : newExtractLog(s);
    const deltaForEnded = () => 0;

    return {
      backgroundColor: resolveColor(s.color, pl),
      label: s.label,
      fill: false,
      getDataPoints: () =>
        getDataPoints(data, initialValue, extractChange, extractLog, null, deltaForEnded, includeRounds),
      weight: s.weight,
    };
  });
}

export const simpleChartFactory = (
  simpleSourceFactory: <Source extends SimpleSource<any>>(family: ChartFamily) => SimpleSourceFactory<Source>
): ChartFactory<SimpleSource<any>> => ({
  includeRounds: "except-final",

  sources(family: ChartFamily): SimpleSource<any>[] {
    return simpleSourceFactory(family).sources;
  },
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: SimpleSource<any>[],
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
  kindBreakdownTitle(family: ChartFamily, source: SimpleSource<any>): string {
    return `${source.label} of all players`;
  },
  stacked() {
    return false;
  },
  showWeightedTotal(family: ChartFamily): boolean {
    return simpleSourceFactory(family).showWeightedTotal;
  },
});

export const simpleChartFactoryEntries = (nonVpAdvTechTiles: Map<AdvTechTile, string>) => {
  const sourceFactories = simpleSourceFactories(nonVpAdvTechTiles);

  function simpleSourceFactory<Source extends SimpleSource<any>>(family: ChartFamily): SimpleSourceFactory<Source> {
    return sourceFactories.find((f) => f.name == family) as SimpleSourceFactory<Source>;
  }

  const scf = simpleChartFactory(simpleSourceFactory);

  return sourceFactories.map((value) => [value.name, scf] as [ChartFamily, ChartFactory<any>]);
};
