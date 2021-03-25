import Engine, { Building, Command, LogEntry, Player, PlayerEnum, Resource } from "@gaia-project/engine";
import { ChartConfiguration, ChartDataset } from "chart.js";
import {
  chartPlayerOrder,
  DatasetFactory,
  EventFilter,
  getDataPoints,
  IncludeRounds,
  lineChartConfig,
  logEntryProcessor,
  playerColor,
  playerLabel,
  weightedSum,
} from "./charts";

export type SimpleSource<Kind> = {
  type: Kind;
  label: string;
  plural: string;
  color: string;
  weight: number;
};

export type SimpleSourceFactory<T extends SimpleSource<any>> = {
  name: string;
  playerSummaryLineChartTitle: (sources: T[]) => string;
  sources: T[];
  extractChange?: (wantPlayer: Player, type: T) => EventFilter;
  extractLog?: (wantPlayer: Player, type: T) => (moveHistory: string[], entry: LogEntry) => number;
};

export type ResourceKind = Resource | "pay-pw";

type ResourceSource = {
  type: ResourceKind;
  inverseOf?: Resource;
  label: string;
  plural: string;
  color: string;
  weight: number;
};

export const resourceSources: SimpleSourceFactory<ResourceSource> = {
  name: "Resources",
  playerSummaryLineChartTitle: (sources) =>
    `Resources of all players as if bought with power (${sources
      .filter((s) => s.weight > 0)
      .map((s) => `${s.label}=${s.weight}`)
      .join(", ")})`,
  extractChange: (wantPlayer, type) => (player, source, resource, round, change) =>
    player == wantPlayer.player && ((resource == type.type && change > 0) || (resource == type.inverseOf && change < 0))
      ? Math.abs(change)
      : 0,
  sources: [
    {
      type: Resource.Credit,
      label: "Credit",
      plural: "Credits",
      color: "--res-credit",
      weight: 1,
    },
    {
      type: Resource.Ore,
      label: "Ore",
      plural: "Ores",
      color: "--res-ore",
      weight: 3,
    },
    {
      type: Resource.Knowledge,
      label: "Knowledge",
      plural: "Knowledge",
      color: "--res-knowledge",
      weight: 4,
    },
    {
      type: Resource.Qic,
      label: "QIC",
      plural: "QICs",
      color: "--res-qic",
      weight: 4,
    },
    {
      type: Resource.ChargePower,
      label: "Power Charges",
      plural: "Power Charges",
      color: "--res-power",
      weight: 0,
    },
    {
      type: "pay-pw",
      inverseOf: Resource.ChargePower,
      label: "Spent Power",
      plural: "Spent Power",
      color: "--lost",
      weight: 0,
    },
    {
      type: Resource.GainToken,
      label: "Gained Tokens",
      plural: "Gained Tokens",
      color: "--recent",
      weight: 0,
    },
  ],
};

export const buildingSources: SimpleSourceFactory<SimpleSource<Building>> = {
  name: "Buildings",
  playerSummaryLineChartTitle: () => "Power value of all buildings of all players (1-3 base power value)",
  extractLog: (wantPlayer, type) =>
    logEntryProcessor(wantPlayer, (cmd) => {
      if (cmd.command == Command.Build) {
        const t = cmd.args[0] as Building;
        if (type.type == t || (type.type == Building.Academy1 && t == Building.Academy2)) {
          return 1;
        }
      }
      return 0;
    }),
  sources: [
    {
      type: Building.Mine,
      label: "Mine",
      plural: "Mines",
      color: "--res-ore",
      weight: 1,
    },
    {
      type: Building.TradingStation,
      label: "Trading Station",
      plural: "Trading Stations",
      color: "--res-credit",
      weight: 2,
    },
    {
      type: Building.ResearchLab,
      label: "Research Lab",
      plural: "Research Labs",
      color: "--res-knowledge",
      weight: 2,
    },
    {
      type: Building.PlanetaryInstitute,
      label: "Planetary Institute",
      plural: "Planetary Institutes",
      color: "--current-round",
      weight: 3,
    },
    {
      type: Building.Academy1,
      label: "Academy",
      plural: "Academies",
      color: "--rt-terra",
      weight: 3,
    },
    {
      type: Building.GaiaFormer,
      label: "Gaia Former",
      plural: "Gaia Formers",
      color: "--rt-gaia",
      weight: 0,
    },
  ],
};

function simpleChartDetails<T extends SimpleSource<any>>(
  factory: SimpleSourceFactory<T>,
  data: Engine,
  player: PlayerEnum,
  canvas: HTMLCanvasElement,
  sources: T[],
  includeRounds: IncludeRounds
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }
  const style = window.getComputedStyle(canvas);

  return sources.map((s) => {
    const color = style.getPropertyValue(s.color);

    const initialValue = 0;
    const extractChange = factory.extractChange?.(pl, s) ?? (() => 0);
    const extractLog = factory.extractLog?.(pl, s) ?? (() => 0);
    const deltaForEnded = () => 0;

    return {
      backgroundColor: color,
      label: s.label,
      fill: false,
      getDataPoints: () =>
        getDataPoints(data, initialValue, extractChange, extractLog, () => 0, deltaForEnded, includeRounds),
      weight: s.weight,
    };
  });
}

export function newSimpleBarChart<T extends SimpleSource<any>>(
  factory: SimpleSourceFactory<T>,
  data: Engine,
  canvas: HTMLCanvasElement
): ChartConfiguration<"bar"> {
  const sources = factory.sources;
  const datasets: ChartDataset<"bar">[] = chartPlayerOrder(data)
    .filter((pl) => data.player(pl).faction != null)
    .map((pl) => {
      const points = simpleChartDetails(factory, data, pl, canvas, sources, "last").map((f) => f.getDataPoints()[0]);
      const player = data.player(pl);
      return {
        data: points,
        label: playerLabel(player),
        backgroundColor: playerColor(player, false),
        borderColor: "black",
        borderWidth: 1,
      };
    });

  return {
    type: "bar",
    data: {
      labels: sources.map((s) => s.label),
      datasets: datasets,
    },
    options: {
      plugins: {
        title: {
          text: `${factory.name} of all players`,
          display: true,
        },
      },
      responsive: true,
    },
  };
}

export function newSimpleLineChart<Kind, T extends SimpleSource<Kind>>(
  factory: SimpleSourceFactory<T>,
  data: Engine,
  canvas: HTMLCanvasElement,
  kind: PlayerEnum | Kind
): ChartConfiguration<"line"> {
  const allSources = factory.sources;
  let title: string;
  let factories: DatasetFactory[];
  if (typeof kind == "number") {
    const numbers = kind === PlayerEnum.All ? chartPlayerOrder(data) : [kind as PlayerEnum];

    if (numbers.length == 1) {
      const player = numbers[0];
      title = `${factory.name} of ${playerLabel(data.player(player))}`;
      factories = simpleChartDetails(factory, data, player, canvas, allSources, "except-final");
    } else {
      title = factory.playerSummaryLineChartTitle(allSources);
      factories = numbers.map((p) =>
        weightedSum(data, p, canvas, simpleChartDetails(factory, data, p, canvas, allSources, "except-final"))
      );
    }
  } else {
    const sources = allSources.filter((r) => r.type === (kind as Kind));

    title = `${sources[0].plural} of all players`;
    factories = chartPlayerOrder(data).map((p) => {
      const pl = data.player(p);
      if (!pl.faction) {
        return null;
      }

      return {
        backgroundColor: playerColor(pl, true),
        label: playerLabel(pl),
        fill: false,
        getDataPoints: () => simpleChartDetails(factory, data, p, canvas, sources, "except-final")[0].getDataPoints(),
        weight: 1,
      };
    });
  }

  return lineChartConfig(
    title,
    canvas,
    data,
    factories.filter((f) => f != null),
    false,
    "except-final"
  );
}
