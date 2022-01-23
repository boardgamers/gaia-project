import Engine, {
  EventSource,
  FactionBoard,
  factionBoard,
  LogEntry,
  Player,
  PlayerEnum,
  Resource,
  Round,
} from "@gaia-project/engine";
import { factionName } from "../../data/factions";
import { ColorVar, playerColor } from "../../graphics/colors";
import { ChartKind } from "./chart-factory";

export type ChartStyle = "table" | "chart";

export type ChartStyleDisplay = {
  type: ChartStyle;
  compact: boolean;
  label: string;
};

export type ChartColor = string | ((player: Player) => string);

export type ChartFamily = string;

export const vpChartFamily = "Victory Points";

export const finalScoringRound = Round.LastRound + 1;

export class ChartSource<Type extends ChartKind> {
  type: Type;
  label: string;
  description?: string;
  color: ChartColor;
  weight: number;
}

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type EventFilter = (
  player: PlayerEnum,
  source: EventSource,
  resource: Resource,
  round: number,
  change: number,
  move?: number
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

export type DataFactoryWithPoints = {
  factory: DatasetFactory;
  points: number[];
};

export function chartPlayerOrder(data: Engine): PlayerEnum[] {
  return data.players.map((p) => p.player);
}

export function extractChanges(
  player: PlayerEnum,
  extractChange: EventFilter
): (entry: LogEntry, logIndex: number) => number {
  return (logItem, logIndex) => {
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
          change[resource],
          logIndex
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
  extractChange: (entry: LogEntry, logIndex: number) => number,
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
  data.advancedLog.forEach((logItem, logIndex) => {
    if (logItem.round != null) {
      if (includeRounds != "last") {
        round = logItem.round;
      }
      onRound(logItem.round);
    }

    counter += extractLog(data.moveHistory, logItem);

    if (logItem.changes) {
      counter += extractChange(logItem, logIndex);
    }
    perRoundData[round] = counter;
  });

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

export function playerLabel(pl: Player) {
  return factionName(pl.faction);
}

export function weightedSumForDataPoints(
  data: Engine,
  player: PlayerEnum,
  dataPoints: DataFactoryWithPoints[]
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
      dataPoints
        .map((f) => f.points.map((p) => f.factory.weight * p))
        .reduce((prev: number[], cur: number[]) => {
          for (let i = 0; i < cur.length; i++) {
            prev[i] += cur[i];
          }
          return prev;
        }),
    weight: 1,
  };
}

export function weightedSum(data: Engine, player: PlayerEnum, factories: DatasetFactory[]): DatasetFactory | null {
  return weightedSumForDataPoints(
    data,
    player,
    factories.map((f) => ({ factory: f, points: f.getDataPoints() }))
  );
}

export function chartPlayerBoard(player: Player): FactionBoard {
  return player.board ?? factionBoard(player.faction, player.variant?.board);
}
