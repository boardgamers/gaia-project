import Engine, {
  AdvTechTilePos,
  BoardAction,
  Booster,
  Command,
  EventSource,
  Faction,
  factionBoard,
  factions,
  finalRankings,
  gainFinalScoringVictoryPoints,
  LogEntry,
  Planet,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
  RoundScoring,
  TechPos,
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
import { sortBy, sum, sumBy } from "lodash";
import { planetColor } from "../graphics/utils";
import { parseCommands } from "./recent";

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

type EventFilter = (
  player: PlayerEnum,
  source: EventSource,
  resource: Resource,
  round: number,
  change: number
) => number;

interface DatasetFactory {
  backgroundColor: string;
  fill: string | false;
  label: string;
  description?: string;
  getDataPoints: () => number[];
  weight: number;
}

function simulateIncome(pl: Player, consume: (p: Player) => void): number {
  const json = JSON.parse(JSON.stringify(pl));
  delete json.federationCache; // otherwise we need to pass the map when loading
  const clone = Player.fromData(json, null, 0);
  consume(clone);
  return clone.data.victoryPoints - pl.data.victoryPoints;
}

type VictoryPointAggregate = {
  label: string;
  description: string;
  color: string;
};

const charge: VictoryPointAggregate = {
  label: "Charge",
  description: "10 starting points - initial bid - points spend for power charges",
  color: "--res-power",
};

const finalScoring: VictoryPointAggregate = {
  label: "Final",
  description: "Final Scoring A + B",
  color: "--rt-sci",
};

const otherScoring: VictoryPointAggregate = {
  label: "Other",
  description: "Base Tech Tiles, Gleens special",
  color: "--tech-tile",
};

type VictoryPointType = EventSource | "chart-init" | "chart-bid" | "chart-spend" | "chart-final1" | "chart-final2";

const aggregateColor = "black"; //this is never displayed, because it's only in the bar chart

type IncludeRounds = "all" | "except-final" | "last";

export type ResourceKind = Resource | "pay-pw";

export type ResourceSource = {
  type: ResourceKind;
  inverseOf?: Resource;
  label: string;
  plural: string;
  color: string;
  weight: number;
};

export const resourceSources: ResourceSource[] = [
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
];

type VictoryPointSource = {
  type: VictoryPointType[];
  label: string;
  description: string;
  color: string;
  projectedEndValue?: (e: Engine, p: Player) => number;
  initialValue?: (p: Player) => number;
  aggregate?: VictoryPointAggregate;
};

const victoryPointSources: VictoryPointSource[] = [
  {
    type: ["chart-init"],
    label: "Initial",
    description: "10 starting points",
    color: aggregateColor,
    aggregate: charge,
    initialValue: () => 10,
  },
  {
    type: ["chart-bid"],
    label: "Bid",
    description: "Initial bid",
    color: aggregateColor,
    aggregate: charge,
    initialValue: (p) => -p.data.bid,
  },
  {
    type: [Command.ChargePower],
    label: "Charge",
    description: "Points spend for power charges",
    color: aggregateColor,
    aggregate: charge,
  },
  {
    type: TechPos.values(),
    label: "Base Tech",
    description: "Base Tech Tiles",
    color: aggregateColor,
    aggregate: otherScoring,
  },
  {
    type: [Faction.Gleens],
    label: "Gleens",
    description: "Gleens special",
    color: aggregateColor,
    aggregate: otherScoring,
  },
  {
    type: RoundScoring.values(),
    label: "Round",
    description: "Round Bonus",
    color: "--rt-gaia",
  },
  {
    type: Booster.values(),
    label: "Booster",
    description: "Round Boosters",
    color: "--oxide",
    projectedEndValue: (e, p) => (e.ended ? 0 : simulateIncome(p, (clone) => clone.receivePassIncome())),
  },
  {
    type: BoardAction.values(),
    label: "QIC",
    description: "QIC actions",
    color: "--specialAction",
  },
  {
    type: ([Command.UpgradeResearch] as VictoryPointType[]).concat(ResearchField.values()),
    label: "Research",
    description: "Research in counted in the round where the level is reached",
    color: "--res-knowledge",
  },
  {
    type: AdvTechTilePos.values(),
    label: "Advanced Tech",
    description: "Advanced Tech Tiles",
    color: "--current-round",
  },
  {
    type: [Command.FormFederation],
    label: "Federation",
    description: "Re-scoring is counted as QIC action",
    color: "--federation",
  },
  {
    type: ["chart-final1"],
    label: "Final A",
    description: "Final Scoring A",
    color: aggregateColor,
    aggregate: finalScoring,
    projectedEndValue: (engine: Engine, pl: Player) =>
      simulateIncome(pl, (clone) =>
        gainFinalScoringVictoryPoints(finalRankings([engine.tiles.scorings.final[0]], engine.players), clone)
      ),
  },
  {
    type: ["chart-final2"],
    label: "Final B",
    description: "Final Scoring B",
    color: aggregateColor,
    aggregate: finalScoring,
    projectedEndValue: (engine: Engine, pl: Player) =>
      simulateIncome(pl, (clone) =>
        gainFinalScoringVictoryPoints(finalRankings([engine.tiles.scorings.final[1]], engine.players), clone)
      ),
  },
  {
    type: ["chart-spend"],
    label: "Resources",
    description: "Points for the remaining resources converted to credits",
    color: "--res-credit",
    projectedEndValue: (_: Engine, pl: Player) => simulateIncome(pl, (clone) => clone.data.finalResourceHandling()),
  },
];

export function chartPlayerOrder(data: Engine) {
  return data.players.map((p) => p.player);
}

function getDataPoints(
  data: Engine,
  initialValue: number,
  extractChange: EventFilter,
  extractLog: (LogEntry) => number,
  projectedEndValue: () => number,
  deltaForEnded: () => number,
  includeRounds: IncludeRounds
): number[] {
  const perRoundData: number[] = [0, NaN, NaN, NaN, NaN, NaN, NaN];
  if (includeRounds === "all") {
    perRoundData.push(0);
  }

  let counter = initialValue;
  let round = 0;

  perRoundData[round] = counter;
  for (const logItem of data.advancedLog) {
    if (logItem.round != null && includeRounds != "last") {
      round = logItem.round;
    }

    counter += extractLog(logItem);

    const changes = logItem.changes;
    if (changes) {
      for (const source in changes) {
        const change = changes[source];
        for (const resource in change) {
          counter += extractChange(
            logItem.player,
            source as EventSource,
            resource as Resource,
            round,
            change[resource]
          );
        }
      }
    }
    perRoundData[round] = counter;
  }

  if (data.ended) {
    counter += deltaForEnded();
    perRoundData[6] = counter;
  }

  if (projectedEndValue != null) {
    counter += projectedEndValue();
  }
  if (includeRounds === "all") {
    perRoundData[7] = counter;
  }
  return perRoundData;
}

export function countResearch(moveHistory: string[], faction: Faction) {
  const research = new Map<ResearchField, number>();
  factionBoard(faction).income[0].rewards.forEach((r) => {
    if (r.type.startsWith("up-")) {
      research.set(r.type.slice(3) as ResearchField, 1);
    }
  });

  return (log: LogEntry) => {
    let delta = 0;
    if (log.move != null) {
      const move = moveHistory[log.move]; // current move isn't added yet
      if (move != null) {
        for (const cmd of parseCommands(move)) {
          if (cmd.faction == faction && cmd.command == Command.UpgradeResearch) {
            const field = cmd.args[0] as ResearchField;
            const newLevel = (research.get(field) ?? 0) + 1;
            research.set(field, newLevel);
            if (newLevel >= 3) {
              delta += 4;
            }
          }
        }
      }
    }
    return delta;
  };
}

function groupSources(sources: VictoryPointSource[]): VictoryPointSource[] {
  const res: VictoryPointSource[] = [];

  const groupTypes = new Map<string, VictoryPointSource>();

  for (const source of sources) {
    const aggregate = source.aggregate;
    if (aggregate != null) {
      let group = groupTypes.get(aggregate.label);
      if (group == null) {
        group = {
          type: [],
          label: aggregate.label,
          description: aggregate.description,
          color: aggregate.color,
          projectedEndValue: (e, p) => 0,
          initialValue: (p) => 0,
        };
        groupTypes.set(aggregate.label, group);
        res.push(group);
      }
      group.type.push(...source.type);
      if (source.projectedEndValue != null) {
        const last = group.projectedEndValue;
        group.projectedEndValue = (e, p) => last(e, p) + source.projectedEndValue(e, p);
      }
      if (source.initialValue != null) {
        const last = group.initialValue;
        group.initialValue = (p) => last(p) + source.initialValue(p);
      }
    } else {
      res.push(source);
    }
  }

  return res;
}

function victoryPointDetails(
  data: Engine,
  player: PlayerEnum,
  canvas: HTMLCanvasElement,
  sources: VictoryPointSource[]
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }
  const wantPlayer = player;

  const style = window.getComputedStyle(canvas);

  return sources.map((s) => {
    const type = s.type;
    const values = Object.values(type) as VictoryPointType[];
    const color = style.getPropertyValue(s.color);

    const initialValue = s.initialValue != null ? s.initialValue(pl) : 0;

    const extractChange = (player, source, resource, round, change) =>
      player == wantPlayer && resource == Resource.VictoryPoint && values.includes(source) ? change : 0;

    const extractLog = s.type.includes(Command.UpgradeResearch) ? countResearch(data.moveHistory, pl.faction) : () => 0;

    const deltaForEnded = () => {
      if (s.type.includes(Command.UpgradeResearch)) {
        // research was already counted in chart separately
        return -simulateIncome(pl, (clone) => clone.data.gainResearchVictoryPoints());
      }
      return 0;
    };

    return {
      backgroundColor: color,
      label: s.label,
      description: s.description,
      fill: "-1",
      getDataPoints: () =>
        getDataPoints(
          data,
          initialValue,
          extractChange,
          extractLog,
          () => (s.projectedEndValue == null ? 0 : s.projectedEndValue(data, pl)),
          deltaForEnded,
          "all"
        ),
      weight: 1,
    };
  });
}

function resourceDetails(
  data: Engine,
  player: PlayerEnum,
  canvas: HTMLCanvasElement,
  sources: ResourceSource[],
  includeRounds: IncludeRounds
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }
  const wantPlayer = player;

  const style = window.getComputedStyle(canvas);

  return sources.map((s) => {
    const color = style.getPropertyValue(s.color);

    const initialValue = 0;
    const extractChange = (player, source, resource, round, change) =>
      player == wantPlayer && ((resource == s.type && change > 0) || (resource == s.inverseOf && change < 0))
        ? Math.abs(change)
        : 0;

    const extractLog = () => 0;
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

function playerColor(pl: Player, invert: boolean) {
  const planet: Planet = factions[pl.faction].planet;
  return invert && planet == Planet.Ice ? "black" : planetColor(planet);
}

function playerLabel(pl: Player) {
  return factions[pl.faction].name;
}

function weightedSum(
  data: Engine,
  player: PlayerEnum,
  canvas: HTMLCanvasElement,
  factories: DatasetFactory[]
): DatasetFactory | null {
  const pl = data.player(player);
  if (!pl.faction) {
    return null;
  }

  return {
    backgroundColor: playerColor(pl, true),
    label: playerLabel(pl),
    fill: false,
    getDataPoints: () =>
      factories
        .map((f) => f.getDataPoints().map((p) => f.weight * p))
        .reduce((prev: number[], cur: number[]) => {
          for (let i = 0; i < cur.length; i++) {
            prev[i] += cur[i];
          }
          return prev;
        }),
    weight: 1,
  };
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

function lineChartConfig(
  title: string,
  canvas: HTMLCanvasElement,
  data: Engine,
  datasetFactories: DatasetFactory[],
  stacked: boolean,
  includeRounds: IncludeRounds
): ChartConfiguration<"line"> {
  const datasets: ChartDataset<"line">[] = datasetFactories.map((f) => ({
    backgroundColor: f.backgroundColor,
    borderColor: f.backgroundColor,
    data: f.getDataPoints().map((val, i) => ({ x: i, y: val })),
    fill: f.fill,
    label: f.label,
  }));

  const labels = ["Start", "Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6"];
  if (includeRounds == "all") {
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
        return String(sumBy(datasets, (s) => s.data[dataIndex].y));
      },
    };
  }

  return {
    type: "line",
    data: {
      labels: labels,
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
        y: {
          // temporary type hack until chart.js's typing is fixed
          stacked: (stacked ? "single" : false) as any,
        },
      },
    },
  };
}

export function newVictoryPointsBarChart(data: Engine, canvas: HTMLCanvasElement): ChartConfiguration<"bar"> {
  const datasets: ChartDataset<"bar">[] = sortBy(
    chartPlayerOrder(data)
      .filter((pl) => data.player(pl).faction != null)
      .map((pl) => {
        const points = victoryPointDetails(data, pl, canvas, victoryPointSources).map((f) => f.getDataPoints()[7]);
        const player = data.player(pl);
        const total = sum(points);
        return {
          data: {
            data: points,
            label: `${playerLabel(player)} (${total})`,
            backgroundColor: playerColor(player, false),
            borderColor: "black",
            borderWidth: 1,
          },
          points: total,
        };
      }),
    (d) => -d.points
  ).map((d) => d.data);

  const tooltipOptions: DeepPartial<TooltipOptions<"bar">> = {
    callbacks: {
      afterTitle(this: TooltipModel<"bar">, items: TooltipItem<"bar">[]): string | string[] {
        const dataIndex = items[0].dataIndex;
        return ` (${victoryPointSources[dataIndex].description})`;
      },
    },
  };

  return {
    type: "bar",
    data: {
      labels: victoryPointSources.map((s) => s.label),
      datasets: datasets,
    },
    options: {
      plugins: {
        tooltip: tooltipOptions,
        title: {
          text: "Victory points of all players",
          display: true,
        },
      } as any,
      responsive: true,
    },
  };
}

export function newResourcesBarChart(data: Engine, canvas: HTMLCanvasElement): ChartConfiguration<"bar"> {
  const datasets: ChartDataset<"bar">[] = chartPlayerOrder(data)
    .filter((pl) => data.player(pl).faction != null)
    .map((pl) => {
      const points = resourceDetails(data, pl, canvas, resourceSources, "last").map((f) => f.getDataPoints()[0]);
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
      labels: resourceSources.map((s) => s.label),
      datasets: datasets,
    },
    options: {
      plugins: {
        title: {
          text: "Resources of all players",
          display: true,
        },
      },
      responsive: true,
    },
  };
}

export function newVictoryPointsLineChart(
  data: Engine,
  canvas: HTMLCanvasElement,
  player: PlayerEnum
): ChartConfiguration<"line"> {
  const numbers = player === PlayerEnum.All ? chartPlayerOrder(data) : [player];

  let title: string;
  let factories: DatasetFactory[];
  if (numbers.length == 1) {
    const p = numbers[0];
    title = `Victory points of ${playerLabel(data.player(p))}`;
    factories = victoryPointDetails(data, p, canvas, groupSources(victoryPointSources));
  } else {
    title = "Victory points of all players";
    factories = numbers.map((p) =>
      weightedSum(data, p, canvas, victoryPointDetails(data, p, canvas, victoryPointSources))
    );
  }

  return lineChartConfig(
    title,
    canvas,
    data,
    factories.filter((f) => f != null),
    player != PlayerEnum.All,
    "all"
  );
}

export function newResourcesLineChart(
  data: Engine,
  canvas: HTMLCanvasElement,
  kind: PlayerEnum | ResourceKind
): ChartConfiguration<"line"> {
  let title: string;
  let factories: DatasetFactory[];
  if (typeof kind == "number") {
    const numbers = kind === PlayerEnum.All ? chartPlayerOrder(data) : [kind as PlayerEnum];

    if (numbers.length == 1) {
      const player = numbers[0];
      title = `Resources of ${playerLabel(data.player(player))}`;
      factories = resourceDetails(data, player, canvas, resourceSources, "except-final");
    } else {
      const conversion = resourceSources
        .filter((s) => s.weight > 0)
        .map((s) => `${s.label}=${s.weight}`)
        .join(", ");
      title = `Resources of all players as if bought with power (${conversion})`;
      factories = numbers.map((p) =>
        weightedSum(data, p, canvas, resourceDetails(data, p, canvas, resourceSources, "except-final"))
      );
    }
  } else {
    const sources = resourceSources.filter((r) => r.type === (kind as Resource));

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
        getDataPoints: () => resourceDetails(data, p, canvas, sources, "except-final")[0].getDataPoints(),
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
