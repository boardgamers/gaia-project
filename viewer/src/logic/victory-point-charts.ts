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
import {
  ColorVar,
  DatasetFactory,
  extractChanges,
  getDataPoints,
  IncludeRounds,
  initialResearch,
  logEntryProcessor,
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

export type VictoryPointType =
  | EventSource
  | "chart-init"
  | "chart-bid"
  | "chart-spend"
  | "chart-final1"
  | "chart-final2";

export type VictoryPointSource = {
  types: VictoryPointType[];
  label: string;
  description: string;
  color: string;
  projectedEndValue?: (e: Engine, p: Player) => number;
  initialValue?: (p: Player) => number;
  aggregate?: VictoryPointAggregate;
};

export const victoryPointSources: VictoryPointSource[] = [
  {
    types: ["chart-init"],
    label: "Initial",
    description: "10 starting points",
    color: "--gaia",
    aggregate: charge,
    initialValue: () => 10,
  },
  {
    types: ["chart-bid"],
    label: "Bid",
    description: "Initial bid",
    color: "--volcanic",
    aggregate: charge,
    initialValue: (p) => -p.data.bid,
  },
  {
    types: [Command.ChargePower],
    label: "Charge",
    description: "Points spend for power charges",
    color: "--res-power",
    aggregate: charge,
  },
  {
    types: TechPos.values(),
    label: "Base Tech",
    description: "Base Tech Tiles",
    color: "--tech-tile",
    aggregate: otherScoring,
  },
  {
    types: [Faction.Gleens],
    label: "Gleens",
    description: "Gleens special",
    color: "--desert",
    aggregate: otherScoring,
  },
  {
    types: RoundScoring.values(),
    label: "Round",
    description: "Round Bonus",
    color: "--rt-gaia",
  },
  {
    types: Booster.values(),
    label: "Booster",
    description: "Round Boosters",
    color: "--oxide",
    projectedEndValue: (e, p) =>
      e.isLastRound && e.passedPlayers.includes(p.player) ? 0 : simulateIncome(p, (clone) => clone.receivePassIncome()),
  },
  {
    types: BoardAction.values(),
    label: "QIC",
    description: "QIC actions",
    color: "--specialAction",
  },
  {
    types: ([Command.UpgradeResearch] as VictoryPointType[]).concat(ResearchField.values()),
    label: "Research",
    description: "Research in counted in the round where the level is reached",
    color: "--res-knowledge",
  },
  {
    types: AdvTechTilePos.values(),
    label: "Advanced Tech",
    description: "Advanced Tech Tiles",
    color: "--current-round",
  },
  {
    types: [Command.FormFederation],
    label: "Federation",
    description: "Re-scoring is counted as QIC action",
    color: "--federation",
  },
  {
    types: ["chart-final1"],
    label: "Final A",
    description: "Final Scoring A",
    color: "--rt-sci",
    aggregate: finalScoring,
    projectedEndValue: (engine: Engine, pl: Player) =>
      simulateIncome(pl, (clone) =>
        gainFinalScoringVictoryPoints(finalRankings([engine.tiles.scorings.final[0]], engine.players), clone)
      ),
  },
  {
    types: ["chart-final2"],
    label: "Final B",
    description: "Final Scoring B",
    color: "--dig",
    aggregate: finalScoring,
    projectedEndValue: (engine: Engine, pl: Player) =>
      simulateIncome(pl, (clone) =>
        gainFinalScoringVictoryPoints(finalRankings([engine.tiles.scorings.final[1]], engine.players), clone)
      ),
  },
  {
    types: ["chart-spend"],
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

export function groupSources(sources: VictoryPointSource[]): VictoryPointSource[] {
  const res: VictoryPointSource[] = [];

  const groupTypes = new Map<string, VictoryPointSource>();

  for (const source of sources) {
    const aggregate = source.aggregate;
    if (aggregate != null) {
      let group = groupTypes.get(aggregate.label);
      if (group == null) {
        group = {
          types: [],
          label: aggregate.label,
          description: aggregate.description,
          color: aggregate.color,
          projectedEndValue: () => 0,
          initialValue: () => 0,
        };
        groupTypes.set(aggregate.label, group);
        res.push(group);
      }
      group.types.push(...source.types);
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

export function victoryPointDetails(
  data: Engine,
  player: PlayerEnum,
  sources: VictoryPointSource[],
  includeRounds: IncludeRounds
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }
  const wantPlayer = player;

  return sources.map((s) => {
    const type = s.types;
    const values = Object.values(type) as VictoryPointType[];

    const initialValue = s.initialValue != null ? s.initialValue(pl) : 0;

    const extractChange = extractChanges(wantPlayer, (player, source, resource, round, change) =>
      resource == Resource.VictoryPoint && values.includes(source) ? change : 0
    );

    const extractLog = s.types.includes(Command.UpgradeResearch) ? countResearch(pl) : () => 0;

    const deltaForEnded = () => {
      if (s.types.includes(Command.UpgradeResearch)) {
        // research was already counted in chart separately
        return -simulateIncome(pl, (clone) => clone.data.gainResearchVictoryPoints());
      }
      return 0;
    };

    return {
      backgroundColor: new ColorVar(s.color),
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
          includeRounds
        ),
      weight: 1,
    };
  });
}
