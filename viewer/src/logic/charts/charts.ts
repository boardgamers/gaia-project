import Engine, {
  EventSource,
  factionBoard,
  factionPlanet,
  LogEntry,
  Planet,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
  Round,
} from "@gaia-project/engine";
import { factionName } from "../../data/factions";
import { ChartStyleDisplay } from "./chart-factory";

export type ChartColor = string | ((player: Player) => string);

export type ChartFamily = string;

export const vpChartFamily = "Victory Points";

export const finalScoringRound = Round.LastRound + 1;

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

export function extractChanges(player: PlayerEnum, extractChange: EventFilter): (entry: LogEntry) => number {
  return (logItem) => {
    if (player != logItem.player) {
      return 0;
    }
    let counter = 0;
    for (const source in logItem.changes) {
      const change = logItem.changes[source];
      for (const resource in change) {
        counter += extractChange(
          logItem.player,
          source as EventSource,
          resource as Resource,
          logItem.round,
          change[resource]
        );
      }
    }
    return counter;
  };
}

function lastIndex(includeRounds: IncludeRounds): number {
  switch (includeRounds) {
    case "last":
      return 0;
    case "except-final":
      return Round.LastRound;
    case "all":
      return finalScoringRound;
  }
}

export function getDataPoints(
  data: Engine,
  initialValue: number,
  extractChange: (entry: LogEntry) => number,
  extractLog: (moveHistory: string[], entry: LogEntry) => number,
  roundValues: Map<number, number> | null,
  deltaForEnded: () => number,
  includeRounds: IncludeRounds
): number[] {
  const perRoundData: number[] = [0, NaN, NaN, NaN, NaN, NaN, NaN];
  if (includeRounds === "all") {
    perRoundData.push(0);
  }

  let counter = initialValue;
  const onRound = (round: number) => {
    if (roundValues != null) {
      counter += roundValues.get(round) ?? 0;
    }
  };

  let round = 0;
  onRound(0);

  perRoundData[round] = counter;
  for (const logItem of data.advancedLog) {
    if (logItem.round != null) {
      if (includeRounds != "last") {
        round = logItem.round;
      }
      onRound(logItem.round);
    }

    counter += extractLog(data.moveHistory, logItem);

    if (logItem.changes) {
      counter += extractChange(logItem);
    }
    perRoundData[round] = counter;
  }

  const lastRound = lastIndex(includeRounds);

  if (data.ended) {
    counter += deltaForEnded();
    perRoundData[round] = counter;
  }
  for (let i = data.round + 1; i <= finalScoringRound; i++) {
    if (i <= lastRound) {
      round = i;
    }
    onRound(i);
    perRoundData[round] = counter;
  }

  perRoundData[lastRound] = counter;
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

  lookupForChart(style: ChartStyleDisplay, canvas: HTMLCanvasElement): string {
    if (style.type == "chart") {
      return this.lookup(canvas);
    }
    return this.color;
  }

  lookup(canvas: HTMLElement): string | null {
    return window.getComputedStyle(canvas).getPropertyValue(this.color);
  }
}

export function resolveColor(color: ChartColor, player: Player): ColorVar {
  return new ColorVar(typeof color == "string" ? color : color(player));
}

export function planetColor(planet: Planet, invert: boolean): string {
  if (invert && planet == Planet.Ice) {
    return "--current-round";
  } else if (planet == Planet.Empty) {
    //for lantids guest mine
    return "--recent";
  } else {
    return (
      "--" +
      Object.keys(Planet)
        .find((k) => Planet[k] == planet)
        .toLowerCase()
    );
  }
}

export function playerColor(pl: Player, invert: boolean): ColorVar {
  return new ColorVar(planetColor(factionPlanet(pl.faction), invert));
}

export function playerLabel(pl: Player) {
  return factionName(pl.faction);
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

export function initialResearch(player: Player): Map<ResearchField, number> {
  const research = new Map<ResearchField, number>();
  const board = player.board ?? factionBoard(player.faction, player.variant?.board);
  board.income[0].rewards.forEach((r) => {
    if (r.type.startsWith("up-")) {
      const key = r.type.slice(3) as ResearchField;
      research.set(key, (research.get(key) ?? 0) + 1);
    }
  });
  return research;
}
