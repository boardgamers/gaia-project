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
import { CommandObject, parseCommands } from "./recent";
import {ChartStyleDisplay} from "./chart-factory";

export type ChartColor = string | ((player: Player) => string);

export enum ChartFamily {
  vp = "vp",
  resources = "resources",
  freeActions = "free-actions",
  boardActions = "board-actions",
  buildings = "buildings",
  research = "research",
  planets = "planets",
  terraforming = "terraforming",
}

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
  backgroundColor: ColorVar;
  fill: string | false;
  label: string;
  description?: string;
  getDataPoints: () => number[];
  weight: number;
}

export type IncludeRounds = "all" | "except-final" | "last";

export function chartPlayerOrder(data: Engine): PlayerEnum[] {
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
  } else if (includeRounds === "last") {
    perRoundData[0] = counter;
  }

  return perRoundData;
}

export class ColorVar {
  color: string;

  constructor(color: string) {
    if (!color.startsWith("--")) {
      throw `${color} does not start with --`;
    }
    this.color = color;
  }

  asVar() {
    return `var(${this.color})`;
  }

  lookupForChart(style: ChartStyleDisplay, canvas: HTMLCanvasElement): string {
    if (style.type == "chart") {
      return this.lookup(canvas);
    }
    return this.color;
  }

  lookup(canvas: HTMLCanvasElement): string | null {
    return window.getComputedStyle(canvas).getPropertyValue(this.color);
  }
}

export function resolveColor(color: ChartColor, player: Player) {
  return typeof color == "string" ? color : color(player);
}

export function planetColor(planet: Planet, invert: boolean): string {
  return invert && planet == Planet.Ice
    ? "--current-round"
    : "--" +
        Object.keys(Planet)
          .find((k) => Planet[k] == planet)
          .toLowerCase();
}

export function playerColor(pl: Player, invert: boolean): ColorVar {
  return new ColorVar(planetColor(factions[pl.faction].planet, invert));
}

export function playerLabel(pl: Player) {
  return factions[pl.faction].name;
}

export function weightedSum(data: Engine, player: PlayerEnum, factories: DatasetFactory[]): DatasetFactory | null {
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
