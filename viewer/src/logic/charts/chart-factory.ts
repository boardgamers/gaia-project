import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  Event,
  Faction,
  Player,
  PlayerEnum,
  Resource,
  tiles,
} from "@gaia-project/engine";
import {
  ChartConfiguration,
  ChartDataset,
  ChartEvent,
  LegendItem,
  LegendOptions,
  TooltipItem,
  TooltipModel,
  TooltipOptions,
} from "chart.js";
import { memoize, sortBy, sum, sumBy } from "lodash";
import { factionName } from "../../data/factions";
import { ColorVar, playerColor, resolveColor } from "../../graphics/colors";
import {
  ChartFamily,
  chartPlayerOrder,
  ChartSource,
  ChartStyleDisplay,
  DatasetFactory,
  DeepPartial,
  IncludeRounds,
  playerLabel,
  vpChartFamily,
  weightedSum,
} from "./charts";
import { finalScoringSources } from "./final-scoring";
import { createSimpleSourceFactories, simpleChartFactoryEntries } from "./simple-sources";
import {
  advancedTechTileSource,
  boosterSource,
  groupSources,
  victoryPointDetails,
  VictoryPointSource,
  victoryPointSources,
} from "./victory-point-charts";

export type DatasetMeta = { [key: string]: { label: string; total: number; weightedTotal: number } };
export type TableMeta = { weights?: number[]; colors?: ColorVar[]; datasetMeta: DatasetMeta };
export type BarChartConfig = { chart: ChartConfiguration<"bar">; table: TableMeta };

export type ChartKind = string | PlayerEnum;
export const barChartKind: ChartKind = "bar";
export const lineChartKind: ChartKind = "line";

export type ChartKindDisplay = { label: string; kind: ChartKind };

export type ChartFactory<Source extends ChartSource<any>> = {
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
  stacked(kind: ChartKind);
  showWeightedTotal(family: ChartFamily): boolean;
};

function victoryPointSource(source: ChartSource<any>, sources: VictoryPointSource[]): VictoryPointSource {
  return sources.find((s) => s.types[0] == source.type);
}

const vpChartFactory = (title: string, allSources: VictoryPointSource[]): ChartFactory<ChartSource<any>> => ({
  includeRounds: "all",
  sources(): ChartSource<any>[] {
    return allSources.map((s) => ({
      type: s.types[0],
      label: s.label,
      description: s.description,
      color: s.color,
      weight: 1,
    }));
  },
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: ChartSource<any>[],
    includeRounds: IncludeRounds,
    family: ChartFamily,
    groupDatasets: boolean
  ) {
    const vpSources = sources.map((s) => victoryPointSource(s, allSources));
    const grouped = groupDatasets ? groupSources(vpSources) : vpSources;
    return victoryPointDetails(data, player, grouped, includeRounds);
  },
  singlePlayerSummaryTitle(player: Player): string {
    return `${title} of ${playerLabel(player)}`;
  },
  playerSummaryTitle(): string {
    return `${title} of all players`;
  },
  kindBreakdownTitle(family: ChartFamily, source: ChartSource<any>): string {
    return `${victoryPointSource(source, allSources).label} of all players`;
  },
  stacked(kind: ChartKind) {
    return Object.values(PlayerEnum).includes(kind) && kind != PlayerEnum.All;
  },
  showWeightedTotal(): boolean {
    return false;
  },
});

function cropLabels(style: ChartStyleDisplay, labels: string[]): string[] {
  if (style.type == "chart" && style.compact) {
    return labels.map((l) => l.slice(0, 1));
  }
  return labels;
}

function newLegendOptions(provider: (index: number) => string) {
  let hovering = false;
  const tooltip = document.getElementById("tooltip");

  const legendOptions: DeepPartial<LegendOptions> = {
    onHover(event: ChartEvent, legendItem: LegendItem) {
      const description = provider(legendItem.datasetIndex);
      if (hovering || description == null) {
        return;
      }
      hovering = true;
      tooltip.innerHTML = description;
      tooltip.style.left = event.x + "px";
      tooltip.style.top = event.y + 40 + "px";
    },
    onLeave() {
      hovering = false;
      tooltip.innerHTML = "";
    },
  };
  return legendOptions;
}

function xScaleOptions(style: ChartStyleDisplay) {
  if (style.compact) {
    return {
      ticks: {
        autoSkip: false,
        maxRotation: 0,
      },
    };
  }
  return null;
}

function vpChartFactoryEntries(
  finalTileName: (tile) => string,
  advTechTiles: Map<AdvTechTile, string>,
  data: Engine,
  boosters: Booster[]
): [ChartFamily, ChartFactory<any>][] {
  return [
    [vpChartFamily, vpChartFactory("Victory Points", victoryPointSources(finalTileName, data.expansions))],
    [
      "Advanced Tech Tiles (Victory Points)",
      vpChartFactory(
        "Victory Points from Advanced Tech Tiles",
        Array.from(advTechTiles.entries()).map(([tile, color]) => advancedTechTileSource(data, tile, color))
      ),
    ],
    [
      "Boosters (Victory Points)",
      vpChartFactory(
        "Victory Points from Boosters",
        boosters.map((b) => boosterSource(data, b))
      ),
    ],
  ];
}

export class ChartSetup {
  chartFactories: Map<ChartFamily, ChartFactory<any>>;
  families: ChartFamily[];

  constructor(engine: Engine, statistics = false) {
    const scoringTechTile: (tile: AdvTechTile) => boolean = (tile: AdvTechTile) =>
      new Event(tiles.techs[tile][0]).rewards.some((r) => r.type == Resource.VictoryPoint);
    const expansions = engine.expansions;
    const currentAdvTechTiles: Map<AdvTechTile, string> = new Map(
      AdvTechTilePos.values(expansions).map((tile) => [
        engine.tiles.techs[tile].tile as AdvTechTile,
        tile.replace("adv", "--rt"),
      ])
    );
    const singleColorTechTile = (tiles: AdvTechTile[]) => new Map(tiles.map((v) => [v, "--tech-tile"]));
    const vpAdvTechTiles = statistics
      ? singleColorTechTile(AdvTechTile.values(expansions).filter(scoringTechTile))
      : currentAdvTechTiles;
    const nonVpAdvTechTiles = statistics
      ? singleColorTechTile(AdvTechTile.values(expansions).filter((t) => !scoringTechTile(t)))
      : currentAdvTechTiles;

    const scoringBooster: (booster: Booster) => boolean = (booster: Booster) =>
      new Event(tiles.boosters[booster][1]).rewards.some((r) => r.type == Resource.VictoryPoint);
    const currentBoosters = Booster.values().filter((b) => engine.tiles.boosters[b] != null);
    const vpBoosters = statistics ? Booster.values().filter(scoringBooster) : currentBoosters;
    const allBoosters = statistics ? Booster.values() : currentBoosters;

    const finalTiles = engine.tiles.scorings.final;
    const finalTileName = (tile) =>
      statistics ? `Final ${String.fromCharCode(65 + tile)}` : finalScoringSources[finalTiles[tile]].name;

    const factions: Faction[] = statistics ? Object.values(Faction) : engine.players.map((p) => p.faction);

    this.chartFactories = new Map<ChartFamily, ChartFactory<any>>(
      vpChartFactoryEntries(finalTileName, vpAdvTechTiles, engine, vpBoosters).concat(
        simpleChartFactoryEntries(
          createSimpleSourceFactories(
            nonVpAdvTechTiles,
            allBoosters,
            statistics ? [] : finalTiles,
            factions,
            expansions
          )
        )
      )
    );

    this.families = Array.from(this.chartFactories.keys()).sort();
  }

  chartFactory(family: ChartFamily): ChartFactory<any> {
    return this.chartFactories.get(family);
  }

  newLineChart(
    style: ChartStyleDisplay,
    family: ChartFamily,
    data: Engine,
    canvas: HTMLCanvasElement,
    kind: ChartKind
  ): ChartConfiguration<"line"> {
    const f = this.chartFactory(family);

    let title: string;
    let factories: DatasetFactory[];

    const allSources = f.sources(family);
    const includeRounds = f.includeRounds;
    if (typeof kind == "number") {
      const numbers = kind === PlayerEnum.All ? chartPlayerOrder(data) : [kind as PlayerEnum];

      if (numbers.length == 1) {
        const p = numbers[0];
        title = f.singlePlayerSummaryTitle(data.player(p), family);
        factories = f.newDetails(data, p, allSources, includeRounds, family, style.type == "chart");
      } else {
        title = f.playerSummaryTitle(family);
        factories = numbers.map((p) =>
          weightedSum(data, p, f.newDetails(data, p, allSources, includeRounds, family, false))
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
          getDataPoints: () => f.newDetails(data, p, sources, includeRounds, family, false)[0].getDataPoints(),
          weight: 1,
        };
      });
    }

    const datasetFactories = factories.filter((f) => f != null);
    const stacked = f.stacked(kind);

    const datasets: ChartDataset<"line">[] = datasetFactories.map((f) => {
      const color = f.backgroundColor.lookupForChart(style, canvas);
      return {
        backgroundColor: color,
        borderColor: color,
        data: f.getDataPoints().map((val, i) => ({ x: i, y: val })),
        fill: f.fill,
        label: f.label,
      };
    });

    const labels = ["Start", "Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6"];
    if (includeRounds === "all") {
      if (data.ended) {
        labels.push("Final");
      } else {
        labels.push("Est. Final");
      }
    }

    const tooltipOptions: DeepPartial<TooltipOptions<"line">> = {};
    if (stacked) {
      tooltipOptions.callbacks = {
        afterTitle(this: TooltipModel<"line">, items: TooltipItem<"line">[]): string | string[] {
          const dataIndex = items[0].dataIndex;
          return String(sumBy(datasets, (s) => (s.data[dataIndex] as any).y));
        },
      };
    }

    return {
      type: "line",
      data: {
        labels: cropLabels(style, labels),
        datasets: datasets,
      },
      options: {
        plugins: {
          title: {
            text: title,
            display: true,
          },
          tooltip: tooltipOptions,
          legend: newLegendOptions((index) => datasetFactories[index]?.description),
        } as any,
        spanGaps: true,
        elements: {
          line: {
            tension: 0.000001,
          },
        },
        scales: {
          x: xScaleOptions(style),
          y: {
            // temporary type hack until chart.js's typing is fixed
            stacked: (stacked ? "single" : false) as any,
          },
        },
      },
    };
  }

  newBarChart(style: ChartStyleDisplay, family: ChartFamily, data: Engine, canvas: HTMLCanvasElement): BarChartConfig {
    const f = this.chartFactory(family);
    const showWeightedTotal = f.showWeightedTotal(family);

    const datasetMeta: DatasetMeta = {};

    const sources: ChartSource<any>[] = f.sources(family);
    const players = chartPlayerOrder(data);
    const datasets: ChartDataset<"bar">[] = sortBy(
      players
        .filter((pl) => data.player(pl).faction != null)
        .map((pl) => {
          // only calculate data points once
          const details = f.newDetails(data, pl, sources, "last", family, false).map((f) => {
            const res = Object.assign({}, f);
            res.getDataPoints = memoize(f.getDataPoints);
            return res;
          });
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
            backgroundColor: playerColor(player, style.type == "table").lookupForChart(style, canvas),
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

    const player = data.player(players[0]);
    return {
      table: {
        weights: showWeightedTotal ? sources.map((s) => s.weight) : null,
        colors: sources.map((s) => resolveColor(s.color, player)),
        datasetMeta: datasetMeta,
      },
      chart: {
        type: "bar",
        data: {
          labels: cropLabels(
            style,
            sources.map((s) => s.label)
          ),
          datasets: datasets,
        },
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                afterTitle(this: TooltipModel<"bar">, items: TooltipItem<"bar">[]): string | string[] {
                  const description = sources[items[0].dataIndex].description;
                  return description ? ` (${description})` : null;
                },
              },
            },
            title: {
              text: f.playerSummaryTitle(family),
              display: true,
            },
          } as any,
          responsive: true,
          scales: {
            x: xScaleOptions(style),
          },
        },
      },
    };
  }

  kinds(data: Engine, family: ChartFamily): ChartKindDisplay[][] {
    const players = chartPlayerOrder(data);

    const general: ChartKindDisplay[] = [
      {
        kind: barChartKind,
        label: "Overview",
      },
      {
        kind: lineChartKind,
        label: "Over Time",
      },
    ];
    const playerDetails: ChartKindDisplay[] = players.map((p) => ({
      kind: p,
      label: factionName(data.player(p).faction),
    }));
    const kinds: ChartKindDisplay[] = this.chartFactory(family)
      .sources(family)
      .map((s) => ({
        kind: s.type,
        label: s.label,
      }));

    return [general, playerDetails, kinds];
  }
}
