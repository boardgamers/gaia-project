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
  Phase,
  Planet,
  Player,
  PlayerData,
  PlayerEnum,
  ResearchField,
  Resource,
  RoundScoring,
  TechPos,
} from "@gaia-project/engine";
import { ChartConfiguration, ChartDataSets, ChartTooltipOptions } from "chart.js";
import { planetColor } from "../graphics/utils";
import { parseCommands } from "./recent";

type EventFilter = (
  player: PlayerEnum,
  source: EventSource,
  resource: Resource,
  round: number,
  change: number
) => number;

interface DatasetFactory {
  backgroundColor: string;
  borderColor: string;
  fill: string | boolean;
  label: string;
  getDataPoints: () => number[];
}

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction
  );
}

function simulateIncome(pl: Player, consume: (d: PlayerData) => void): number {
  const clone = pl.data.clone();
  consume(clone);
  return clone.victoryPoints - pl.data.victoryPoints;
}

function finalScoring(data: Engine, pl: Player) {
  const allRankings = finalRankings(data.tiles.scorings.final, data.players);

  return simulateIncome(pl, (d) => gainFinalScoringVictoryPoints(allRankings, pl, (r, e) => d.gainRewards(r, e)));
}

function resourceVictoryPoints(_: Engine, pl: Player) {
  return simulateIncome(pl, (d) => d.finalResourceHandling());
}

const victoryPointSources: {
  type: EventSource[];
  label: string;
  color: string;
  projectedEndValue?: (e: Engine, p: Player) => number;
}[] = [
  {
    type: [Command.ChargePower],
    label: "charge",
    color: "--res-power",
  },
  {
    type: Booster.values(),
    label: "booster",
    color: "--oxide",
    projectedEndValue: (e, p) =>
      simulateIncome(p, (d) => p.receivePassIncome((rewards, source) => d.gainRewards(rewards, true, source))),
  },
  {
    type: TechPos.values(),
    label: "tech tile",
    color: "--tech-tile",
  },
  {
    type: AdvTechTilePos.values(),
    label: "advanced tech tile",
    color: "--current-round",
  },
  {
    type: RoundScoring.values(),
    label: "round",
    color: "--res-credit",
  },
  {
    type: ([Command.UpgradeResearch] as EventSource[]).concat(ResearchField.values()),
    label: "research",
    color: "--res-knowledge",
  },
  {
    type: BoardAction.values(),
    label: "board action",
    color: "--specialAction",
  },
  {
    type: [Command.FormFederation],
    label: "federation",
    color: "--federation",
  },
  {
    type: ["final1", "final2"],
    label: "final",
    color: "--recent",
    projectedEndValue: finalScoring,
  },
  {
    type: [Command.Spend],
    label: "resources",
    color: "--dig",
    projectedEndValue: resourceVictoryPoints,
  },
];

function getDataPoints(
  data: Engine,
  initialValue: number,
  extractChange: EventFilter,
  extractLog: (LogEntry) => number,
  projectedEndValue: () => number,
  deltaForEnded: () => number
): number[] {
  const perRoundData: number[] = [0, NaN, NaN, NaN, NaN, NaN, NaN, 0];

  let counter = initialValue;
  let round = 0;

  perRoundData[round] = counter;
  for (const logItem of data.advancedLog) {
    if (logItem.round != null) {
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
  } else if (projectedEndValue != null) {
    counter += projectedEndValue();
  }
  perRoundData[7] = counter;
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
      for (const cmd of parseCommands(moveHistory[log.move])) {
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
    return delta;
  };
}

export function victoryPointDetails(data: Engine, player: PlayerEnum, canvas: HTMLCanvasElement): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }
  const wantPlayer = player;

  const style = window.getComputedStyle(canvas);

  return victoryPointSources.map((s) => {
    const type = s.type;
    const values = Object.values(type) as EventSource[];
    const color = style.getPropertyValue(s.color);

    const initialValue = s.type.includes(Command.ChargePower) ? 10 - pl.data.bid : 0;
    const extractChange = (player, source, resource, round, change) =>
      player == wantPlayer && resource == Resource.VictoryPoint && values.includes(source) ? change : 0;

    const extractLog = s.type.includes(Command.UpgradeResearch) ? countResearch(data.moveHistory, pl.faction) : () => 0;

    const deltaForEnded = () => {
      if (s.type.includes(Command.UpgradeResearch)) {
        // research was already counted in chart separately
        return -simulateIncome(pl, (d) => d.gainResearchVictoryPoints());
      }
      return 0;
    };

    return {
      borderColor: color,
      backgroundColor: color,
      label: s.label,
      fill: "-1",
      getDataPoints: () =>
        getDataPoints(
          data,
          initialValue,
          extractChange,
          extractLog,
          () => (s.projectedEndValue == null ? 0 : s.projectedEndValue(data, pl)),
          deltaForEnded
        ),
    };
  });
}

export function victoryPointSummary(
  data: Engine,
  player: PlayerEnum,
  canvas: HTMLCanvasElement
): DatasetFactory | null {
  const pl = data.player(player);
  if (!pl.faction) {
    return null;
  }

  const factories = victoryPointDetails(data, player, canvas);

  const planet: Planet = factions[pl.faction].planet;
  const color = planet == Planet.Ice ? "black" : planetColor(planet);

  return {
    borderColor: color,
    backgroundColor: undefined,
    label: factions[pl.faction].name,
    fill: false,
    getDataPoints: () =>
      factories
        .map((f) => f.getDataPoints())
        .reduce((prev: number[], cur: number[]) => {
          for (let i = 0; i < cur.length; i++) {
            prev[i] += cur[i];
          }
          return prev;
        }),
  };
}

export function makeChart(data: Engine, datasetFactories: DatasetFactory[], stacked: boolean): ChartConfiguration {
  const datasets: ChartDataSets[] = datasetFactories.map((f) => ({
    borderColor: f.borderColor,
    backgroundColor: f.backgroundColor,
    data: f.getDataPoints(),
    fill: f.fill,
    label: f.label,
  }));

  const labels = ["start", "round 1", "round 2", "round 3", "round 4", "round 5", "round 6"];
  if (!data.ended) {
    labels.push("est. final");
  }

  const tooltipOptions: ChartTooltipOptions = {};
  if (stacked) {
    tooltipOptions.callbacks = {
      afterTitle(item: Chart.ChartTooltipItem[], data: Chart.ChartData): string | string[] {
        let val = 0;
        for (const dataset of data.datasets) {
          val += Number(dataset.data[item[0].index]);
        }
        return String(val);
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
      tooltips: tooltipOptions,
      spanGaps: true,
      elements: {
        line: {
          tension: 0.000001,
        },
      },
      scales: {
        yAxes: [
          {
            stacked: stacked,
          },
        ],
      },
    },
  };
}
