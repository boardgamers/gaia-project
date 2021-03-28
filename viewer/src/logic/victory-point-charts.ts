import Engine, {
  AdvTechTilePos,
  BoardAction,
  Booster,
  Command,
  EventSource,
  Faction,
  finalRankings,
  gainFinalScoringVictoryPoints,
  LogEntry,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
  RoundScoring,
  TechPos,
} from "@gaia-project/engine";
import { ChartConfiguration, ChartDataset, TooltipItem, TooltipModel, TooltipOptions } from "chart.js";
import { sortBy, sum } from "lodash";
import {
  chartPlayerOrder,
  DatasetFactory,
  DeepPartial,
  getDataPoints,
  initialResearch,
  lineChartConfig,
  logEntryProcessor,
  playerColor,
  playerLabel,
  weightedSum,
} from "./charts";

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
    projectedEndValue: (e, p) =>
      e.isLastRound && e.passedPlayers.includes(p.player) ? 0 : simulateIncome(p, (clone) => clone.receivePassIncome()),
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

export function countResearch(player: Player): (moveHistory: string[], log: LogEntry) => number {
  const research = initialResearch(player);

  return logEntryProcessor(player, (cmd) => {
    if (cmd.command == Command.UpgradeResearch) {
      const field = cmd.args[0] as ResearchField;
      const newLevel = (research.get(field) ?? 0) + 1;
      research.set(field, newLevel);
      if (newLevel >= 3) {
        return 4;
      }
    }
    return 0;
  });
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

    const extractLog = s.type.includes(Command.UpgradeResearch) ? countResearch(pl) : () => 0;

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
