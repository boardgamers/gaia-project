import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  Booster,
  Command,
  Event,
  EventSource,
  Expansion,
  Faction,
  finalRankings,
  gainFinalScoringVictoryPoints,
  LogEntry,
  Operator,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
  Round,
  RoundScoring,
  TechPos,
} from "@gaia-project/engine";
import { sum } from "lodash";
import { boosterData } from "../../data/boosters";
import { advancedTechTileData } from "../../data/tech-tiles";
import { ColorVar } from "../../graphics/colors";
import { colorCodes } from "../color-codes";
import {
  DatasetFactory,
  extractChanges,
  finalScoringRound,
  getDataPoints,
  IncludeRounds,
  initialResearch,
} from "./charts";
import { logEntryProcessor } from "./simple-charts";

function simulateIncome(pl: Player, consume: (p: Player) => void, engineVersion: string): number {
  const json = JSON.parse(JSON.stringify(pl));
  delete json.federationCache; // otherwise we need to pass the map when loading
  const clone = Player.fromData(json, null, null, 0, engineVersion);
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
  | "chart-final2"
  | AdvTechTile;

export type VictoryPointSource = {
  types: VictoryPointType[];
  label: string;
  description?: string;
  color: string;
  roundValues?: (e: Engine, p: Player) => Map<number, number>;
  initialValue?: (p: Player) => number;
  aggregate?: VictoryPointAggregate;
};

function vpProjection(events: Event[], sources: EventSource[], e: Engine, eachRound: boolean, addedRounds: number) {
  let points = 0;
  for (const e of events) {
    if (sources.includes(e.source)) {
      for (const reward of e.rewards) {
        if (reward.type == Resource.VictoryPoint) {
          points += reward.count;
        }
      }
    }
  }

  const map = new Map<number, number>();
  for (let round = e.round + addedRounds; round <= Round.LastRound; round++) {
    map.set(round, points);
    if (!eachRound) {
      break;
    }
  }
  return map;
}

function passIncomeProjection(
  sources: EventSource[],
  eachRound: boolean
): (e: Engine, p: Player) => Map<number, number> | null {
  return (e, p) => {
    const hasPassed = e.passedPlayers?.includes(p.player) ?? false;
    if (e.isLastRound && hasPassed) {
      return null;
    }
    return vpProjection(p.passIncomeEvents(), sources, e, eachRound, hasPassed ? 1 : 0);
  };
}

function incomeProjection(sources: EventSource[]): (e: Engine, p: Player) => Map<number, number> | null {
  return (e, p) => {
    if (e.isLastRound) {
      return null;
    }
    return vpProjection(p.events[Operator.Income], sources, e, true, 1);
  };
}

function finalScoringProjection(finalTile: number): (engine: Engine, pl: Player) => Map<any, number> {
  return (engine: Engine, pl: Player) => {
    const points = simulateIncome(
      pl,
      (clone) =>
        gainFinalScoringVictoryPoints(finalRankings([engine.tiles.scorings.final[finalTile]], engine.players), clone),
      engine.version
    );
    return new Map([[finalScoringRound, points]]);
  };
}

export const victoryPointSources = (
  finalTileName: (tile: number) => string,
  expansion: Expansion
): VictoryPointSource[] => {
  const sources: VictoryPointSource[] = [
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
      roundValues: passIncomeProjection(Booster.values(), false),
    },
    {
      types: BoardAction.values(),
      label: "QIC",
      description: "QIC actions",
      color: "--specialAction",
    },
    {
      types: ([Command.UpgradeResearch] as VictoryPointType[]).concat(ResearchField.values(expansion)),
      label: "Research",
      description: "Research in counted in the round where the level is reached",
      color: "--res-knowledge",
    },
    {
      types: AdvTechTilePos.values(expansion),
      label: "Advanced Tech",
      description: "Advanced Tech Tiles",
      color: "--current-round",
      roundValues: passIncomeProjection(AdvTechTilePos.values(expansion), true),
    },
    {
      types: [Command.FormFederation],
      label: "Federation",
      description: "Re-scoring is counted as QIC action",
      color: colorCodes.federation.color,
    },
    {
      types: ["chart-final1"],
      label: finalTileName(0),
      description: "Final Scoring A",
      color: "--rt-sci",
      aggregate: finalScoring,
      roundValues: finalScoringProjection(0),
    },
    {
      types: ["chart-final2"],
      label: finalTileName(1),
      description: "Final Scoring B",
      color: "--dig",
      aggregate: finalScoring,
      roundValues: finalScoringProjection(1),
    },
    {
      types: ["chart-spend"],
      label: "Resources",
      description: "Points for the remaining resources converted to credits",
      color: "--res-credit",
      roundValues: (e: Engine, pl: Player) =>
        new Map([[finalScoringRound, simulateIncome(pl, (clone) => clone.data.finalResourceHandling(), e.version)]]),
    },
  ];
  if (expansion == Expansion.Frontiers) {
    sources.push(
      {
        types: [Command.ChooseIncome],
        label: "Colonies",
        description: "Income from colonies",
        color: "--rt-nav",
        roundValues: incomeProjection([Command.ChooseIncome]),
      },
      {
        types: ["trade"],
        label: "Trade",
        description: "Trade with colonies",
        color: "--rt-dip",
      }
    );
  }
  return sources;
};

function advancedTechTileTypes(e: Engine, tile: AdvTechTile): AdvTechTilePos[] {
  return Object.entries(e.tiles.techs)
    .filter((entry) => entry[1].tile == tile)
    .map((entry) => entry[0] as AdvTechTilePos);
}

export const advancedTechTileSource = (data: Engine, tile: AdvTechTile, color: string): VictoryPointSource => ({
  types: advancedTechTileTypes(data, tile),
  label: advancedTechTileData[tile].name,
  color: advancedTechTileData[tile].color,
  roundValues: passIncomeProjection(advancedTechTileTypes(data, tile), true),
});

export const boosterSource = (data: Engine, booster: Booster): VictoryPointSource => ({
  types: [booster],
  label: boosterData[booster].name,
  color: boosterData[booster].color,
  roundValues: passIncomeProjection([booster], false),
});

export function countResearch(player: Player): (moveHistory: string[], log: LogEntry) => number {
  const research = initialResearch(player);

  return logEntryProcessor((cmd) => {
    if (cmd) {
      if (cmd.faction == player.faction && cmd.command == Command.UpgradeResearch) {
        const field = cmd.args[0] as ResearchField;
        const newLevel = (research.get(field) ?? 0) + 1;
        research.set(field, newLevel);
        if (newLevel >= 3) {
          return 4;
        }
      } else if (cmd.command == Command.ChooseFaction && cmd.args[0] == player.faction) {
        return sum(Array.from(research.values()).map((level) => Math.max(0, (level - 2) * 4)));
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
          roundValues: () => new Map<number, number>(),
          initialValue: () => 0,
        };
        groupTypes.set(aggregate.label, group);
        res.push(group);
      }
      group.types.push(...source.types);
      if (source.roundValues != null) {
        const last = group.roundValues;
        group.roundValues = (e, p) => {
          const map = source.roundValues(e, p);
          last(e, p).forEach((value, key) => {
            map.set(key, value);
          });
          return map;
        };
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
        return -simulateIncome(pl, (clone) => clone.data.gainResearchVictoryPoints(), data.version);
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
          s.roundValues == null ? null : s.roundValues(data, pl),
          deltaForEnded,
          includeRounds
        ),
      weight: 1,
    };
  });
}
