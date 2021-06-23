import Engine, {
  BoardAction,
  Booster,
  Building,
  Command,
  Faction,
  Federation,
  federations,
  FinalTile,
  LogEntry,
  Planet,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
  Reward,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine";
import { sum } from "lodash";
import { boardActionNames } from "../data/actions";
import { boosterNames } from "../data/boosters";
import { planetsWithSteps } from "../data/factions";
import { federationData } from "../data/federations";
import { planetNames } from "../data/planets";
import { researchNames } from "../data/research";
import { resourceNames } from "../data/resources";
import { baseTechTileNames } from "../data/tech-tiles";
import {
  ChartColor,
  ChartFamily,
  DatasetFactory,
  extractChanges,
  ExtractLog,
  ExtractLogArg,
  getDataPoints,
  IncludeRounds,
  initialResearch,
  logEntryProcessor,
  planetColor,
  planetCounter,
  resolveColor,
  statelessExtractLog,
} from "./charts";
import { finalScoringExtractLog, finalScoringSources } from "./final-scoring";

export enum TerraformingSteps {
  Step0 = "Home world",
  Step1 = "1 step",
  Step2 = "2 steps",
  Step3 = "3 steps",
  GaiaFormer = "Gaia Former",
  Gaia = "Gaia Planet (settled directly)",
  Lantids = "Lantids guest mine",
  LostMine = "Lost Planet",
}

function terraformingSteps(steps: TerraformingSteps): number {
  switch (steps) {
    case TerraformingSteps.Step1:
      return 1;
    case TerraformingSteps.Step2:
      return 2;
    case TerraformingSteps.Step3:
      return 3;
    default:
      return 0;
  }
}

export function planetsForSteps(type: TerraformingSteps, planet: Planet): Planet[] {
  switch (type) {
    case TerraformingSteps.Gaia:
      return [Planet.Gaia];
    case TerraformingSteps.GaiaFormer:
      return [Planet.Transdim];
    case TerraformingSteps.Lantids:
      return [Planet.Empty];
    case TerraformingSteps.LostMine:
      return [Planet.Lost];
    case TerraformingSteps.Step0:
      return [planet];
    default:
      return planetsWithSteps(planet, terraformingSteps(type));
  }
}

export type SimpleSource<Type> = {
  type: Type;
  label: string;
  color: ChartColor;
  weight: number;
};

export type SimpleSourceFactory<Source extends SimpleSource<any>> = {
  name: ChartFamily;
  playerSummaryLineChartTitle: string;
  sources: Source[];
  showWeightedTotal: boolean;
  initialValue?: (player: Player, source: Source) => number;
  extractChange?: (player: Player, source: Source) => (entry: LogEntry) => number;
  extractLog?: ExtractLog<Source>;
};

function commandCounter<T>(...want: Command[]): ExtractLog<SimpleSource<T>> {
  return statelessExtractLog((e) => (want.includes(e.cmd.command) && (e.cmd.args[0] as any) == e.source.type ? 1 : 0));
}

function extractLogMux<T>(mux: { [key in Command]?: ExtractLog<SimpleSource<T>> }): ExtractLog<SimpleSource<T>> {
  return (p) => {
    const map = new Map<Command, (a: ExtractLogArg<SimpleSource<T>>) => number>();
    for (const key of Object.keys(mux)) {
      map.set(key as Command, mux[key as Command](p));
    }
    return (e) => {
      return map.get(e.cmd.command)?.(e) ?? 0;
    };
  };
}

type ResourceSource = SimpleSource<Resource | "range"> & { inverseOf?: Resource };

const resourceWeights: { type: Resource; color: string; weight: number; inverseOf?: Resource }[] = [
  {
    type: Resource.Credit,
    color: "--res-credit",
    weight: 1,
  },
  {
    type: Resource.Ore,
    color: "--res-ore",
    weight: 3,
  },
  {
    type: Resource.Knowledge,
    color: "--res-knowledge",
    weight: 4,
  },
  {
    type: Resource.Qic,
    color: "--res-qic",
    weight: 4,
  },
  {
    type: Resource.ChargePower,
    color: "--res-power",
    weight: 0,
  },
  {
    type: Resource.PayPower,
    inverseOf: Resource.ChargePower,
    color: "--lost",
    weight: 0,
  },
  {
    type: Resource.GainToken,
    color: "--recent",
    weight: 0,
  },
  {
    type: Resource.BurnToken,
    color: "--current-round",
    weight: 0,
  },
];

export const resourceSources: ResourceSource[] = resourceWeights.map((w) => {
  const n = resourceNames.find((n) => n.type == w.type);
  return {
    type: w.type,
    weight: w.weight,
    color: w.color,
    inverseOf: w.inverseOf,
    label: n.plural,
  };
});

const freeActionSources = resourceSources
  .filter((s) => s.weight > 0 || s.type == Resource.GainToken)
  .concat({
    type: "range",
    label: "Range +2",
    color: "--rt-nav",
    weight: 0,
  });

const factories = [
  {
    name: "Resources",
    playerSummaryLineChartTitle: "Resources of all players as if bought with power",
    showWeightedTotal: true,
    extractChange: (wantPlayer, source) =>
      extractChanges(wantPlayer.player, (player, eventSource, resource, round, change) =>
        (resource == source.type && change > 0) || (resource == source.inverseOf && change < 0) ? Math.abs(change) : 0
      ),
    extractLog: statelessExtractLog((e) =>
      e.source.type == Resource.BurnToken && e.cmd.command == Command.BurnPower ? Number(e.cmd.args[0]) : 0
    ),
    sources: resourceSources,
  } as SimpleSourceFactory<ResourceSource>,
  {
    name: "Free actions",
    playerSummaryLineChartTitle:
      "Resources bought with free actions by all players (paid with power, credits, ore, QIC, and gaia formers)",
    showWeightedTotal: true,
    extractLog: extractLogMux({
      [Command.Spend]: statelessExtractLog<ResourceSource>((e) =>
        sum(
          Reward.merge(Reward.parse(e.cmd.args[2]))
            .filter((i) => i.type == e.source.type)
            .map((i) => i.count)
        )
      ),
      [Command.Build]: planetCounter(
        () => false,
        () => false,
        (p, t) => t == "range",
        true,
        (cmd, log, planet) =>
          -(log.changes?.[Command.Build]?.[Resource.Qic] ?? 0) -
          (planet == Planet.Gaia && cmd.faction != Faction.Gleens ? 1 : 0)
      ),
    }),
    sources: freeActionSources,
  } as SimpleSourceFactory<ResourceSource | SimpleSource<"range">>,
  {
    name: "Board actions",
    playerSummaryLineChartTitle: `Board actions taken by all players`,
    showWeightedTotal: false,
    extractLog: commandCounter(Command.Action),
    sources: BoardAction.values().map((action) => ({
      type: action,
      label: boardActionNames[action].name,
      color: boardActionNames[action].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<BoardAction>>,
  {
    name: "Buildings",
    playerSummaryLineChartTitle: "Power value of all buildings of all players (1-3 base power value)",
    showWeightedTotal: true,
    extractLog: statelessExtractLog((e) => {
      if (e.cmd.command == Command.Build) {
        const t = e.cmd.args[0] as Building;
        if (e.source.type == t || (e.source.type == Building.Academy1 && t == Building.Academy2)) {
          return 1;
        }
      }
      return 0;
    }),
    sources: [
      {
        type: Building.Mine,
        label: "Mine",
        color: "--res-ore",
        weight: 1,
      },
      {
        type: Building.TradingStation,
        label: "Trading Station",
        color: "--res-credit",
        weight: 2,
      },
      {
        type: Building.ResearchLab,
        label: "Research Lab",
        color: "--res-knowledge",
        weight: 2,
      },
      {
        type: Building.PlanetaryInstitute,
        label: "Planetary Institute",
        color: "--current-round",
        weight: 3,
      },
      {
        type: Building.Academy1,
        label: "Academy",
        color: "--rt-terra",
        weight: 3,
      },
      {
        type: Building.GaiaFormer,
        label: "Gaia Former",
        color: "--rt-gaia",
        weight: 0,
      },
    ],
  } as SimpleSourceFactory<SimpleSource<Building>>,
  {
    name: "Research",
    playerSummaryLineChartTitle: "Research steps of all players",
    showWeightedTotal: false,
    initialValue: (player, source) => initialResearch(player).get(source.type) ?? 0,
    extractLog: commandCounter(Command.UpgradeResearch),
    sources: Object.keys(researchNames).map((field) => {
      return {
        type: field as ResearchField,
        label: researchNames[field],
        color: `--rt-${field}`,
        weight: 1,
      };
    }),
  } as SimpleSourceFactory<SimpleSource<ResearchField>>,
  {
    name: "Planets",
    playerSummaryLineChartTitle: "Planets of all players",
    showWeightedTotal: false,
    extractLog: planetCounter(
      (source) => source.type == Planet.Empty,
      (source) => source.type == Planet.Lost,
      (p, t) => p == t
    ),
    sources: Object.keys(planetNames)
      .map((t) => {
        const planet = t as Planet;
        return {
          type: planet,
          label: `${planetNames[planet]}`,
          color: planetColor(planet, true),
          weight: 1,
        };
      })
      .concat({
        type: Planet.Empty,
        label: "Lantids guest mine",
        color: "--recent",
        weight: 1,
      }),
  } as SimpleSourceFactory<SimpleSource<Planet>>,
  {
    name: "Terraforming Steps",
    showWeightedTotal: true,
    playerSummaryLineChartTitle: "Terraforming Steps of all players (Gaia planets and gaia formers excluded)",
    extractLog: planetCounter(
      (source) => source.type == TerraformingSteps.Lantids,
      (source) => source.type == TerraformingSteps.LostMine,
      (p, type, player) => planetsForSteps(type, player.planet).includes(p)
    ),
    sources: Object.values(TerraformingSteps).map((steps) => ({
      type: steps,
      label: steps,
      color: (player) => planetColor(planetsForSteps(steps, player.planet)[0], true),
      weight: terraformingSteps(steps),
    })),
  } as SimpleSourceFactory<SimpleSource<TerraformingSteps>>,
  {
    name: "Boosters",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: "Boosters taken by all players",
    extractLog: commandCounter(Command.Pass, Command.ChooseRoundBooster),
    sources: Booster.values().map((b) => ({
      type: b,
      label: boosterNames[b].name,
      color: boosterNames[b].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<Booster>>,
  {
    name: "Federations",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: "Federations of all players",
    extractLog: statelessExtractLog((e) => {
      const type = e.source.type;
      if (e.cmd.command == Command.FormFederation) {
        return (e.cmd.args[1] as Federation) == type ? 1 : 0;
      }
      if (e.allCommands[0] === e.cmd && !e.allCommands.find((c) => c.command == Command.FormFederation)) {
        //only take the federation from changes once, i.e. when seeing the first command
        const c = e.log.changes?.[Command.FormFederation];
        if (c != null) {
          const want = Object.entries(c)
            .map(([r, a]) => (a > 1 ? a : "") + r)
            .join(",");
          if (Object.entries(federations).find(([fed, res]) => res == want)[0] == type) {
            return 1;
          }
        }
      }
      return 0;
    }),
    sources: Federation.values()
      .map((f) => ({
        type: f,
        label: federations[f],
        color: federationData[f].color,
        weight: 1,
      }))
      .concat({
        type: Federation.Gleens,
        label: "Gleens",
        color: "--desert",
        weight: 1,
      }),
  } as SimpleSourceFactory<SimpleSource<Federation>>,
  {
    name: "Base Tech Tiles",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: "Base Tech tiles of all players",
    extractLog: statelessExtractLog((e) => {
      if (e.cmd.command == Command.ChooseTechTile) {
        const pos = e.cmd.args[0] as TechTilePos;
        const tile = e.data.tiles.techs[pos].tile;

        if (tile == e.source.type) {
          return 1;
        }
      }
      return 0;
    }),
    sources: TechTile.values().map((t) => ({
      type: t,
      label: baseTechTileNames[t].name,
      color: baseTechTileNames[t].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<TechTile>>,
  {
    name: "Final Scoring Conditions",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: "All final Scoring Conditions of all players (not only the active ones)",
    extractLog: finalScoringExtractLog,
    sources: Object.keys(finalScoringSources).map((tile) => ({
      type: tile,
      label: finalScoringSources[tile].name,
      color: finalScoringSources[tile].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<FinalTile>>,
];

export function simpleChartDetails<Source extends SimpleSource<any>>(
  factory: SimpleSourceFactory<Source>,
  data: Engine,
  player: PlayerEnum,
  sources: Source[],
  includeRounds: IncludeRounds
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }

  function newExtractLog(s: Source) {
    const e = factory.extractLog(pl);

    return logEntryProcessor((cmd, log, allCommands) =>
      e({
        cmd: cmd,
        allCommands: allCommands,
        source: s,
        data: data,
        log: log,
      })
    );
  }

  return sources.map((s) => {
    const initialValue = factory.initialValue?.(pl, s) ?? 0;
    const extractChange = factory.extractChange?.(pl, s) ?? (() => 0);
    const extractLog = factory.extractLog == null ? () => 0 : newExtractLog(s);
    const deltaForEnded = () => 0;

    return {
      backgroundColor: resolveColor(s.color, pl),
      label: s.label,
      fill: false,
      getDataPoints: () =>
        getDataPoints(data, initialValue, extractChange, extractLog, () => 0, deltaForEnded, includeRounds),
      weight: s.weight,
    };
  });
}

export function simpleSourceFactory<Source extends SimpleSource<any>>(
  family: ChartFamily
): SimpleSourceFactory<Source> {
  return factories.find((f) => f.name == family) as SimpleSourceFactory<Source>;
}

export function simpleSourceFamilies(): ChartFamily[] {
  return factories.map((f) => f.name);
}
