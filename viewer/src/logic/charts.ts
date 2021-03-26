import Engine, {
  EventSource,
  factionBoard,
  factions,
  LogEntry,
  Planet,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
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
import { sumBy } from "lodash";
import { planetColor } from "../graphics/utils";
import { CommandObject, parseCommands } from "./recent";

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type EventFilter = (
  player: PlayerEnum,
  source: EventSource,
  resource: Resource,
  round: number,
  change: number
) => number;

export interface DatasetFactory {
  backgroundColor: string;
  fill: string | false;
  label: string;
  description?: string;
  getDataPoints: () => number[];
  weight: number;
}

export type IncludeRounds = "all" | "except-final" | "last";

export function chartPlayerOrder(data: Engine) {
  return data.players.map((p) => p.player);
}

export function getDataPoints(
  data: Engine,
  initialValue: number,
  extractChange: EventFilter,
  extractLog: (moveHistory: string[], entry: LogEntry) => number,
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

    counter += extractLog(data.moveHistory, logItem);

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

export function playerColor(pl: Player, invert: boolean) {
  const planet: Planet = factions[pl.faction].planet;
  return invert && planet == Planet.Ice ? "black" : planetColor(planet);
}

export function playerLabel(pl: Player) {
  return factions[pl.faction].name;
}

export function weightedSum(
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

export function initialResearch(player: Player) {
  const research = new Map<ResearchField, number>();
  factionBoard(player.faction).income[0].rewards.forEach((r) => {
    if (r.type.startsWith("up-")) {
      research.set(r.type.slice(3) as ResearchField, 1);
    }
  });
  return research;
}

export function logEntryProcessor(
  player: Player,
  processor: (cmd: CommandObject) => number
): (moveHistory: string[], log: LogEntry) => number {
  return (moveHistory: string[], log: LogEntry): number => {
    let res = 0;

    if (log.move != null) {
      const move = moveHistory[log.move]; // current move isn't added yet
      if (move != null) {
        for (const cmd of parseCommands(move)) {
          if (cmd.faction == player.faction) {
            res += processor(cmd);
          }
        }
      }
    }

    return res;
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

export function lineChartConfig(
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
