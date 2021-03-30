import Engine, { Player, PlayerEnum } from "@gaia-project/engine";
import { ChartConfiguration, ChartDataset, TooltipItem, TooltipModel, TooltipOptions } from "chart.js";
import { sortBy, sum } from "lodash";
import {
  ChartColor,
  ChartFamily,
  chartPlayerOrder,
  ColorVar,
  DatasetFactory,
  DeepPartial,
  IncludeRounds,
  lineChartConfig,
  playerColor,
  playerLabel,
  resolveColor,
  weightedSum,
} from "./charts";
import { simpleChartDetails, SimpleChartKind, SimpleSource, simpleSourceFactory } from "./simple-charts";
import {
  groupSources,
  victoryPointDetails,
  VictoryPointSource,
  victoryPointSources,
  VictoryPointType,
} from "./victory-point-charts";

export type ChartKind = "line" | "bar" | PlayerEnum | SimpleChartKind | VictoryPointType;

export type ChartSource<Type extends ChartKind> = {
  type: Type;
  label: string;
  color: ChartColor;
  weight: number;
};

export type ChartFactory<Type extends ChartKind, Source extends ChartSource<Type>> = {
  canHandle(family: ChartFamily): boolean;
  sources(family: ChartFamily): Source[];
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: Source[],
    includeRounds: IncludeRounds,
    family: ChartFamily,
    groupDatasets: boolean
  ): DatasetFactory[];
  singlePlayerSummaryTitle(player: Player, family: ChartFamily): string;
  playerSummaryTitle(family: ChartFamily): string;
  kindBreakdownTitle(family: ChartFamily, source: Source): string;
  includeRounds: IncludeRounds;
  stacked(player: PlayerEnum | ChartKind);
  showWeightedTotal(family: ChartFamily): boolean;
  barChartTooltip?: DeepPartial<TooltipOptions<"bar">>;
};

export function victoryPointSource(source: ChartSource<VictoryPointType>): VictoryPointSource {
  return victoryPointSources.find((s) => s.types[0] == source.type);
}

const simpleChartFactory: ChartFactory<SimpleChartKind, SimpleSource<SimpleChartKind>> = {
  includeRounds: "except-final",

  canHandle(family: ChartFamily): boolean {
    return family != ChartFamily.vp;
  },
  sources(family: ChartFamily): SimpleSource<SimpleChartKind>[] {
    return simpleSourceFactory(family).sources;
  },
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: SimpleSource<SimpleChartKind>[],
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
    return sourceFactory.playerSummaryLineChartTitle(sourceFactory.sources);
  },
  kindBreakdownTitle(family: ChartFamily, source: SimpleSource<SimpleChartKind>): string {
    return `${source.plural} of all players`;
  },
  stacked() {
    return false;
  },
  showWeightedTotal(family: ChartFamily): boolean {
    return simpleSourceFactory(family).showWeightedTotal;
  },
};

const vpChartFactory: ChartFactory<VictoryPointType, ChartSource<VictoryPointType>> = {
  includeRounds: "all",
  canHandle(family: ChartFamily): boolean {
    return family == ChartFamily.vp;
  },
  sources(): ChartSource<VictoryPointType>[] {
    return victoryPointSources.map((s) => ({
      type: s.types[0],
      label: s.label,
      color: s.color,
      weight: 1,
    }));
  },
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: ChartSource<VictoryPointType>[],
    includeRounds: IncludeRounds,
    family: ChartFamily,
    groupDatasets: boolean
  ) {
    const vpSources = sources.map((s) => victoryPointSource(s));
    const grouped = groupDatasets ? groupSources(vpSources) : vpSources;
    return victoryPointDetails(data, player, grouped, includeRounds);
  },
  singlePlayerSummaryTitle(player: Player): string {
    return `Victory points of ${playerLabel(player)}`;
  },
  playerSummaryTitle(): string {
    return "Victory points of all players";
  },
  kindBreakdownTitle(family: ChartFamily, source: ChartSource<VictoryPointType>): string {
    return `${victoryPointSource(source).label} of all players`;
  },
  stacked(player: PlayerEnum) {
    return player != PlayerEnum.All;
  },
  showWeightedTotal(): boolean {
    return false;
  },
  barChartTooltip: {
    callbacks: {
      afterTitle(this: TooltipModel<"bar">, items: TooltipItem<"bar">[]): string | string[] {
        const dataIndex = items[0].dataIndex;
        return ` (${victoryPointSources[dataIndex].description})`;
      },
    },
  },
};

const chartFactories: ChartFactory<any, any>[] = [simpleChartFactory, vpChartFactory];

function chartFactory(family: ChartFamily): ChartFactory<any, any> {
  return chartFactories.find((f) => f.canHandle(family));
}

export function newLineChart(
  family: ChartFamily,
  data: Engine,
  canvas: HTMLCanvasElement,
  kind: PlayerEnum | ChartKind
): ChartConfiguration<"line"> {
  const f = chartFactory(family);

  let title: string;
  let factories: DatasetFactory[];

  const allSources = f.sources(family);
  if (typeof kind == "number") {
    const numbers = kind === PlayerEnum.All ? chartPlayerOrder(data) : [kind as PlayerEnum];

    if (numbers.length == 1) {
      const p = numbers[0];
      title = f.singlePlayerSummaryTitle(data.player(p), family);
      factories = f.newDetails(data, p, allSources, f.includeRounds, family, true);
    } else {
      title = f.playerSummaryTitle(family);
      factories = numbers.map((p) =>
        weightedSum(data, p, f.newDetails(data, p, allSources, f.includeRounds, family, false))
      );
    }
  } else {
    const sources = allSources.filter((r) => r.type === kind);

    const source = sources[0];
    title = f.kindBreakdownTitle(family, source);
    factories = chartPlayerOrder(data).map((p) => {
      const pl = data.player(p);
      if (!pl.faction) {
        return null;
      }

      return {
        backgroundColor: playerColor(pl, true),
        label: playerLabel(pl),
        fill: false,
        getDataPoints: () => f.newDetails(data, p, sources, f.includeRounds, family, false)[0].getDataPoints(),
        weight: 1,
      };
    });
  }

  return lineChartConfig(
    title,
    canvas,
    data,
    factories.filter((f) => f != null),
    f.stacked(kind),
    f.includeRounds
  );
}

export type DatasetMeta = { [key: string]: { label: string; total: number; weightedTotal: number } };
export type TableMeta = { weights?: number[]; datasetMeta: DatasetMeta };
export type BarChartConfig = { chart: ChartConfiguration<"bar">; table: TableMeta };

export function newBarChart(family: ChartFamily, data: Engine, canvas: HTMLCanvasElement): BarChartConfig {
  const f = chartFactory(family);
  const showWeightedTotal = f.showWeightedTotal(family);

  const datasetMeta: DatasetMeta = {};

  const sources = f.sources(family);
  const datasets: ChartDataset<"bar">[] = sortBy(
    chartPlayerOrder(data)
      .filter((pl) => data.player(pl).faction != null)
      .map((pl) => {
        const details = f.newDetails(data, pl, sources, "last", family, false);
        const points = details.map((f) => f.getDataPoints()[0]);

        const total = sum(points);
        const weighted = showWeightedTotal ? weightedSum(data, pl, details).getDataPoints()[0] : null;

        const player = data.player(pl);
        const label = playerLabel(player);
        const key = `${label} (${weighted ?? total})`;
        datasetMeta[key] = {
          label: label,
          total: total,
          weightedTotal: weighted,
        };
        const d: ChartDataset<"bar"> = {
          data: points,
          label: key,
          backgroundColor: playerColor(player, false).lookup(canvas),
          borderColor: "black",
          borderWidth: 1,
        };
        return {
          data: d,
          points: total,
        };
      }),
    (d) => -d.points
  ).map((d) => d.data);

  return {
    table: {
      weights: showWeightedTotal ? sources.map((s) => s.weight) : null,
      datasetMeta: datasetMeta,
    },
    chart: {
      type: "bar",
      data: {
        labels: sources.map((s) => s.label),
        datasets: datasets,
      },
      options: {
        plugins: {
          tooltip: f.barChartTooltip,
          title: {
            text: f.playerSummaryTitle(family),
            display: true,
          },
        } as any,
        responsive: true,
      },
    },
  };
}

export function genericKinds(data: Engine, family: ChartFamily): { color: string; kind: ChartKind }[] {
  const want = [ChartFamily.vp, ChartFamily.boardActions];
  if (want.includes(family)) {
    const player = data.player(chartPlayerOrder(data)[0]);
    return chartFactory(family)
      .sources(family)
      .map((s) => ({
        kind: s.type,
        color: new ColorVar(resolveColor(s.color, player)).asVar(),
      }));
  }
  return [];
}
