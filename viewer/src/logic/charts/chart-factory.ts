import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  Faction,
  Player,
  PlayerEnum,
  Resource,
} from "@gaia-project/engine";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { techTileRewards } from "@gaia-project/engine/src/tiles/techs";
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
import { roundScoringData } from "../../data/round-scorings";
import { playerColor, resolveColor } from "../../graphics/colors";
import {
  ChartGroup,
  chartPlayerOrder,
  ChartSelect,
  ChartSource,
  ChartStyleDisplay,
  ChartType,
  dataPointsBalance,
  DatasetFactory,
  DeepPartial,
  IncludeRounds,
  playerLabel,
  vpChartType,
  weightedSum,
} from "./charts";
import { finalScoringSources } from "./final-scoring";
import { ChartSummary } from "./simple-charts";
import { createSimpleSourceFactories, simpleChartFactory } from "./simple-sources";
import {
  advancedTechTileSource,
  boosterSource,
  groupSources,
  roundScoring,
  victoryPointDetails,
  VictoryPointSource,
  victoryPointSources,
} from "./victory-point-charts";

export type DatasetSummary = {
  label: string;
  total?: number;
  weightedTotal?: number;
  income?: number;
  cost?: number;
  balance?: number;
};
export type DatasetMeta = { [key: string]: DatasetSummary };
export type TableMeta = { weights?: number[]; colors?: string[]; datasetMeta: DatasetMeta; descriptions: string[] };
export type BarChartConfig = { chart: ChartConfiguration<"bar">; table: TableMeta };

export type ChartKind = string | PlayerEnum;
export const barChartKind: ChartKind = "bar";
export const lineChartKind: ChartKind = "line";

export type ChartKindDisplay = { label: string; kind: ChartKind };

export type ChartFactory<Source extends ChartSource<any>> = {
  type: ChartType;
  group?: ChartGroup;
  sources: Source[];
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: Source[],
    includeRounds: IncludeRounds,
    groupDatasets: boolean
  ): DatasetFactory[];
  singlePlayerSummaryTitle(player: Player): string;
  playerSummaryTitle: string;
  kindBreakdownTitle(source: Source): string;
  includeRounds: IncludeRounds;
  stacked(kind: ChartKind);
  summary: ChartSummary;
  roundLabels(source: Source): string[] | null;
};

function victoryPointSource(source: ChartSource<any>, sources: VictoryPointSource[]): VictoryPointSource {
  return sources.find((s) => s.types[0] == source.type);
}

const vpChartFactory = (
  type: ChartType,
  title: string,
  allSources: VictoryPointSource[],
  roundScoringNames: string[] | null
): ChartFactory<ChartSource<any>> => ({
  type: type,
  group: ChartGroup.vp,
  includeRounds: "all",
  sources: allSources.map((s) => ({
    type: s.types[0],
    label: s.label,
    description: s.description,
    color: s.color,
    weight: 1,
  })),
  newDetails(
    data: Engine,
    player: PlayerEnum,
    sources: ChartSource<any>[],
    includeRounds: IncludeRounds,
    groupDatasets: boolean
  ) {
    const vpSources = sources.map((s) => victoryPointSource(s, allSources));
    const grouped = groupDatasets ? groupSources(vpSources) : vpSources;
    return victoryPointDetails(data, player, grouped, includeRounds);
  },
  singlePlayerSummaryTitle(player: Player): string {
    return `${title} of ${playerLabel(player)}`;
  },
  playerSummaryTitle: `${title} of all players`,
  kindBreakdownTitle(source: ChartSource<any>): string {
    return `${victoryPointSource(source, allSources).label} of all players`;
  },
  stacked(kind: ChartKind) {
    return Object.values(PlayerEnum).includes(kind) && kind != PlayerEnum.All;
  },
  summary: ChartSummary.total,
  roundLabels(source: ChartSource<any>): string[] | null {
    return source.label == roundScoring ? roundScoringNames : null;
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
  boosters: Booster[],
  roundScoringNames: string[] | null
): ChartFactory<any>[] {
  return [
    vpChartFactory(
      vpChartType,
      "Victory Points",
      victoryPointSources(finalTileName, data.expansions),
      roundScoringNames
    ),
    vpChartFactory(
      "Advanced Tech Tiles",
      "Victory Points from Advanced Tech Tiles",
      Array.from(advTechTiles.entries()).map(([tile, color]) => advancedTechTileSource(data, tile, color)),
      null
    ),
    vpChartFactory(
      "Boosters",
      "Victory Points from Boosters",
      boosters.map((b) => boosterSource(data, b)),
      null
    ),
  ];
}

export class ChartSetup {
  private readonly chartFactories: ChartFactory<any>[];
  private groups: Map<ChartType, ChartType[]>;
  selects: ChartSelect[];

  constructor(engine: Engine, statistics = false) {
    const scoringTechTile: (tile: AdvTechTile) => boolean = (tile: AdvTechTile) =>
      techTileRewards(tile).some((r) => r.type == Resource.VictoryPoint);
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
      boosterEvents(booster)[1].rewards.some((r) => r.type == Resource.VictoryPoint);
    const currentBoosters = Booster.values().filter((b) => engine.tiles.boosters[b] != null);
    const vpBoosters = statistics ? Booster.values().filter(scoringBooster) : currentBoosters;
    const allBoosters = statistics ? Booster.values() : currentBoosters;

    const finalTiles = engine.tiles.scorings.final;
    const finalTileName = (tile) =>
      statistics ? `Final ${String.fromCharCode(65 + tile)}` : finalScoringSources[finalTiles[tile]].name;
    const roundScoringNames = statistics ? null : engine.tiles.scorings.round.map((r) => roundScoringData[r].name);

    const factions: Faction[] = statistics ? Object.values(Faction) : engine.players.map((p) => p.faction);

    this.chartFactories = vpChartFactoryEntries(
      finalTileName,
      vpAdvTechTiles,
      engine,
      vpBoosters,
      roundScoringNames
    ).concat(
      createSimpleSourceFactories(
        nonVpAdvTechTiles,
        allBoosters,
        statistics ? [] : finalTiles,
        factions,
        expansions
      ).map((f) => simpleChartFactory(f))
    );

    this.selects = [];
    this.groups = new Map();
    for (const f of this.chartFactories) {
      const group = f.group;
      if (group != null) {
        const last = this.groups.get(group);
        if (last == null) {
          this.selects.push(group);
        }
        this.groups.set(group, (last ?? []).concat(f.type));
      } else {
        this.selects.push(f.type);
      }
    }
    this.selects = this.selects.sort();
  }

  factory(chartSelect: ChartSelect, chartType: ChartType | null) {
    const f = this.chartFactories.find((f) =>
      chartType != null ? f.group == chartSelect && f.type == chartType : f.group == null && f.type == chartSelect
    );
    if (f == null) {
      throw Error(`no factory found for "${chartSelect}"/"${chartType}"`);
    }
    return f;
  }

  types(chartSelect: ChartSelect): ChartType[] {
    return this.groups.get(chartSelect) ?? [];
  }

  newLineChart(
    style: ChartStyleDisplay,
    factory: ChartFactory<any>,
    data: Engine,
    kind: ChartKind,
    lookupColor: (c: string) => string
  ): ChartConfiguration<"line"> {
    let title: string;
    let factories: DatasetFactory[];
    let roundLabels: string[] = null;

    const allSources = factory.sources;
    const includeRounds = factory.includeRounds;
    if (typeof kind == "number") {
      const numbers = kind === PlayerEnum.All ? chartPlayerOrder(data) : [kind as PlayerEnum];

      if (numbers.length == 1) {
        const p = numbers[0];
        title = factory.singlePlayerSummaryTitle(data.player(p));
        factories = factory.newDetails(data, p, allSources, includeRounds, style.type == "chart");
      } else {
        title = factory.playerSummaryTitle;
        factories = numbers.map((p) =>
          weightedSum(data, p, factory.newDetails(data, p, allSources, includeRounds, false))
        );
      }
    } else {
      const sources = allSources.filter((r) => r.type === kind);

      const source = sources[0];
      title = factory.kindBreakdownTitle(source);
      roundLabels = factory.roundLabels(source);
      factories = chartPlayerOrder(data).map((p) => {
        const pl = data.player(p);
        if (!pl.faction) {
          return null;
        }

        return {
          backgroundColor: playerColor(pl, true),
          label: playerLabel(pl),
          fill: false,
          getDataPoints: () => factory.newDetails(data, p, sources, includeRounds, false)[0].getDataPoints(),
          weight: 1,
        };
      });
    }

    const datasetFactories = factories.filter((f) => f != null);
    const stacked = factory.stacked(kind);

    const datasets: ChartDataset<"line">[] = datasetFactories.map((f) => {
      const color = lookupColor(f.backgroundColor);
      return {
        backgroundColor: color,
        borderColor: color,
        data: f.getDataPoints().map((val, i) => ({ x: i, y: val })),
        fill: f.fill,
        label: f.label,
      };
    });

    const labels = ["Start", "Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6"];
    roundLabels?.forEach((value, index) => {
      labels[index + 1] += ` (${value})`;
    });
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

  newBarChart(
    style: ChartStyleDisplay,
    factory: ChartFactory<any>,
    data: Engine,
    lookupColor: (c: string) => string
  ): BarChartConfig {
    const datasetMeta: DatasetMeta = {};

    const sources: ChartSource<any>[] = factory.sources;
    const players = chartPlayerOrder(data);
    const datasets: ChartDataset<"bar">[] = sortBy(
      players
        .filter((pl) => data.player(pl).faction != null)
        .map((pl) => {
          // only calculate data points once
          const details = factory.newDetails(data, pl, sources, "last", false).map((f) => {
            const res = Object.assign({}, f);
            res.getDataPoints = memoize(f.getDataPoints);
            return res;
          });
          const points = details.map((f) => f.getDataPoints()[0]);

          const total = sum(points);

          const player = data.player(pl);
          const label = playerLabel(player);
          let key: string;
          const meta: DatasetSummary = {
            label: label,
          };
          if (factory.summary == ChartSummary.total) {
            meta.total = total;
            key = `${label} (${meta.total})`;
          } else if (factory.summary == ChartSummary.balance) {
            const balance = dataPointsBalance(data, pl, details);
            meta.income = balance.income;
            meta.cost = balance.cost;
            meta.balance = meta.income + meta.cost;
            key = `${label} (${meta.income})`;
          } else if (factory.summary == ChartSummary.weightedTotal) {
            meta.total = total;
            meta.weightedTotal = weightedSum(data, pl, details).getDataPoints()[0];
            key = `${label} (${meta.weightedTotal})`;
          }

          datasetMeta[key] = meta;
          const d: ChartDataset<"bar"> = {
            data: points,
            label: key,
            backgroundColor: lookupColor(playerColor(player, style.type == "table")),
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
        weights: factory.summary != ChartSummary.total ? sources.map((s) => s.weight) : null,
        colors: sources.map((s) => resolveColor(s.color, player)),
        datasetMeta: datasetMeta,
        descriptions: sources.map((s) => s.description ?? s.label),
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
              text: factory.playerSummaryTitle,
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

  kinds(data: Engine, factory: ChartFactory<any>): ChartKindDisplay[][] {
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
    const kinds: ChartKindDisplay[] = factory.sources.map((s) => ({
      kind: s.type,
      label: s.label,
    }));

    return [general, playerDetails, kinds];
  }
}
