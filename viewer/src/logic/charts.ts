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
import { ChartConfiguration, ChartDataSets, ChartLegendOptions, ChartTooltipOptions } from "chart.js";
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
  description?: string;
  getDataPoints: () => number[];
}

function simulateIncome(pl: Player, consume: (p: Player) => void): number {
  const json = JSON.parse(JSON.stringify(pl));
  delete json.federationCache; // otherwise we need to pass the map when loading
  const clone = Player.fromData(json, null, 0);
  consume(clone);
  return clone.data.victoryPoints - pl.data.victoryPoints;
}

const victoryPointSources: {
  type: EventSource[];
  label: string;
  description: string;
  color: string;
  projectedEndValue?: (e: Engine, p: Player) => number;
}[] = [
  {
    type: [Command.ChargePower],
    label: "Charge",
    description: "10 starting points - initial bid - points spend for power charges",
    color: "--res-power",
  },
  {
    type: (TechPos.values() as EventSource[]).concat(Faction.Gleens),
    label: "Other",
    description: "Base Tech Tiles, Gleens special",
    color: "--tech-tile",
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
    projectedEndValue: (e, p) => simulateIncome(p, (clone) => clone.receivePassIncome()),
  },
  {
    type: BoardAction.values(),
    label: "QIC",
    description: "QIC actions",
    color: "--specialAction",
  },
  {
    type: ([Command.UpgradeResearch] as EventSource[]).concat(ResearchField.values()),
    label: "Research",
    description: "Research in counted in the round where the level is reached",
    color: "--res-knowledge",
  },
  {
    type: AdvTechTilePos.values(),
    label: "Adv Tech Tiles",
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
    type: ["final1", "final2"],
    label: "Final",
    description: "Final Scoring A + B",
    color: "--rt-sci",
    projectedEndValue: (engine: Engine, pl: Player) =>
      simulateIncome(pl, (clone) =>
        gainFinalScoringVictoryPoints(finalRankings(engine.tiles.scorings.final, engine.players), clone)
      ),
  },
  {
    type: [Command.Spend],
    label: "Resources",
    description: "Points for the remaining resources converted to credits",
    color: "--res-credit",
    projectedEndValue: (_: Engine, pl: Player) => simulateIncome(pl, (clone) => clone.data.finalResourceHandling()),
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
        return -simulateIncome(pl, (clone) => clone.data.gainResearchVictoryPoints());
      }
      return 0;
    };

    return {
      borderColor: color,
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

export function chartConfig(
  canvas: HTMLCanvasElement,
  data: Engine,
  datasetFactories: DatasetFactory[],
  stacked: boolean
): ChartConfiguration {
  const datasets: ChartDataSets[] = datasetFactories.map((f) => ({
    borderColor: f.borderColor,
    backgroundColor: f.backgroundColor,
    data: f.getDataPoints(),
    fill: f.fill,
    label: f.label,
  }));

  const labels = ["Start", "Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6"];
  if (!data.ended) {
    labels.push("Est. Final");
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

  let hovering = false;
  const tooltip = document.getElementById("tooltip");

  const legendOptions: ChartLegendOptions = {
    onHover(event, legendItem) {
      const description = datasetFactories[legendItem.datasetIndex]?.description;
      if (hovering || description == null) {
        return;
      }
      hovering = true;
      tooltip.innerHTML = description;
      tooltip.style.left = event.offsetX + "px";
      tooltip.style.top = event.offsetY + 40 + "px";
    },
    onLeave() {
      hovering = false;
      tooltip.innerHTML = "";
    },
  };

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
      legend: legendOptions,
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
