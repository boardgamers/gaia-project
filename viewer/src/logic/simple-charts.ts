import Engine, {
  BoardAction,
  Building,
  Command,
  Faction,
  Planet,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
  Reward,
} from "@gaia-project/engine";
import { sum } from "lodash";
import { boardActionNames } from "../data/board-actions";
import { planetsWithSteps } from "../data/factions";
import { planetNames } from "../data/planets";
import {
  ChartColor,
  ChartFamily,
  ColorVar,
  DatasetFactory,
  EventFilter,
  getDataPoints,
  IncludeRounds,
  initialResearch,
  logEntryProcessor,
  planetColor,
  resolveColor,
} from "./charts";
import { CommandObject } from "./recent";

export enum TerraformingSteps {
  Step0 = "Home world",
  Step1 = "1 step",
  Step2 = "2 steps",
  Step3 = "3 steps",
  GaiaFormer = "Gaia Former",
  Gaia = "Gaia Planet (settled directly)",
  Lantids = "Lantids guest mine",
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
      return [Planet.Lost];
    case TerraformingSteps.Step0:
      return [planet];
    default:
      return planetsWithSteps(planet, terraformingSteps(type));
  }
}

export type SimpleChartKind = Resource | Building | ResearchField | Planet | TerraformingSteps | BoardAction;

export type SimpleSource<Type extends SimpleChartKind> = {
  type: Type;
  label: string;
  plural: string;
  color: ChartColor;
  weight: number;
};

export type SimpleSourceFactory<Source extends SimpleSource<any>> = {
  family: ChartFamily;
  resourceIcon: Resource;
  resourceIconQuantity?: number;
  name: string;
  playerSummaryLineChartTitle: (sources: Source[]) => string;
  sources: Source[];
  showWeightedTotal: boolean;
  initialValue?: (player: Player, source: Source) => number;
  extractChange?: (player: Player, source: Source) => EventFilter;
  extractLog?: (cmd: CommandObject, source: Source, data: Engine, player: Player) => number;
};

const researchNames = {
  [ResearchField.Terraforming]: "Terraforming",
  [ResearchField.Navigation]: "Navigation",
  [ResearchField.Intelligence]: "Intelligence",
  [ResearchField.GaiaProject]: "Gaia Project",
  [ResearchField.Economy]: "Economy",
  [ResearchField.Science]: "Science",
};

function planetCounter<T extends SimpleChartKind>(
  getPlanets: (type: T, player: Player) => Planet[]
): (cmd: CommandObject, source: SimpleSource<T>, data: Engine, player: Player) => number {
  const transdim = new Set<string>();
  const owners: { [key: string]: PlayerEnum } = {};

  return (cmd, source, data: Engine, player: Player) => {
    if (cmd.command == Command.Build) {
      const building = cmd.args[0] as Building;
      const location = cmd.args[1];
      const { q, r } = data.map.parse(location);
      const hex = data.map.grid.get({ q, r });
      const planet = hex.data.planet;

      const owner = owners[location];
      if (owner == null) {
        owners[location] = player.player;
      } else if (owner != player.player && player.faction == Faction.Lantids) {
        return source.type == TerraformingSteps.Lantids ? 1 : 0;
      }

      const want = getPlanets(source.type, player);

      if (building == Building.GaiaFormer) {
        transdim.add(location);

        if (want.includes(Planet.Transdim)) {
          return 1;
        }
      }

      if (
        want.includes(planet) &&
        (building == Building.Mine || (building == Building.PlanetaryInstitute && player.faction == Faction.Ivits)) &&
        !transdim.has(location)
      ) {
        return 1;
      }
    }
    return 0;
  };
}

type ResourceSource = SimpleSource<Resource> & { inverseOf?: Resource };

const resourceSources: ResourceSource[] = [
  {
    type: Resource.Credit,
    label: "Credit",
    plural: "Credits",
    color: "--res-credit",
    weight: 1,
  },
  {
    type: Resource.Ore,
    label: "Ore",
    plural: "Ores",
    color: "--res-ore",
    weight: 3,
  },
  {
    type: Resource.Knowledge,
    label: "Knowledge",
    plural: "Knowledge",
    color: "--res-knowledge",
    weight: 4,
  },
  {
    type: Resource.Qic,
    label: "QIC",
    plural: "QICs",
    color: "--res-qic",
    weight: 4,
  },
  {
    type: Resource.ChargePower,
    label: "Power Charges",
    plural: "Power Charges",
    color: "--res-power",
    weight: 0,
  },
  {
    type: Resource.PayPower,
    inverseOf: Resource.ChargePower,
    label: "Spent Power",
    plural: "Spent Power",
    color: "--lost",
    weight: 0,
  },
  {
    type: Resource.GainToken,
    label: "Gained Tokens",
    plural: "Gained Tokens",
    color: "--recent",
    weight: 0,
  },
  {
    type: Resource.BurnToken,
    label: "Burned Tokens",
    plural: "Burned Tokens",
    color: "--current-round",
    weight: 0,
  },
];

const freeActionSources = resourceSources.filter((s) => s.weight > 0 || s.type == Resource.GainToken);

const factories = [
  {
    family: ChartFamily.resources,
    name: "Resources",
    resourceIcon: Resource.Qic,
    playerSummaryLineChartTitle: () => "Resources of all players as if bought with power",
    showWeightedTotal: true,
    extractChange: (wantPlayer, source) => (player, eventSource, resource, round, change) =>
      player == wantPlayer.player &&
      ((resource == source.type && change > 0) || (resource == source.inverseOf && change < 0))
        ? Math.abs(change)
        : 0,
    extractLog: (cmd, source) =>
      source.type == Resource.BurnToken && cmd.command == Command.BurnPower ? Number(cmd.args[0]) : 0,
    sources: resourceSources,
  } as SimpleSourceFactory<ResourceSource>,
  {
    family: ChartFamily.freeActions,
    name: "Free actions",
    resourceIcon: Resource.PayPower,
    playerSummaryLineChartTitle: () => "Power, credits, ore, and gaia formers spend on free actions of all players",
    showWeightedTotal: true,
    extractLog: (cmd, source) =>
      cmd.command == Command.Spend
        ? sum(
            Reward.merge(Reward.parse(cmd.args[2]))
              .filter((i) => i.type == source.type)
              .map((i) => i.count)
          )
        : 0,
    sources: freeActionSources,
  } as SimpleSourceFactory<ResourceSource>,
  {
    family: ChartFamily.boardActions,
    name: "Board actions",
    resourceIcon: Resource.PayPower,
    resourceIconQuantity: 4,
    playerSummaryLineChartTitle: () => `Board actions taken by all players`,
    showWeightedTotal: false,
    extractLog: (cmd, source) => (cmd.command == Command.Action && cmd.args[0] == source.type ? 1 : 0),
    sources: BoardAction.values().map((action) => ({
      type: action,
      label: boardActionNames[action].name,
      plural: boardActionNames[action].name,
      color: boardActionNames[action].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<BoardAction>>,
  {
    family: ChartFamily.buildings,
    name: "Buildings",
    resourceIcon: Resource.GaiaFormer,
    playerSummaryLineChartTitle: () => "Power value of all buildings of all players (1-3 base power value)",
    showWeightedTotal: true,
    extractLog: (cmd, source) => {
      if (cmd.command == Command.Build) {
        const t = cmd.args[0] as Building;
        if (source.type == t || (source.type == Building.Academy1 && t == Building.Academy2)) {
          return 1;
        }
      }
      return 0;
    },
    sources: [
      {
        type: Building.Mine,
        label: "Mine",
        plural: "Mines",
        color: "--res-ore",
        weight: 1,
      },
      {
        type: Building.TradingStation,
        label: "Trading Station",
        plural: "Trading Stations",
        color: "--res-credit",
        weight: 2,
      },
      {
        type: Building.ResearchLab,
        label: "Research Lab",
        plural: "Research Labs",
        color: "--res-knowledge",
        weight: 2,
      },
      {
        type: Building.PlanetaryInstitute,
        label: "Planetary Institute",
        plural: "Planetary Institutes",
        color: "--current-round",
        weight: 3,
      },
      {
        type: Building.Academy1,
        label: "Academy",
        plural: "Academies",
        color: "--rt-terra",
        weight: 3,
      },
      {
        type: Building.GaiaFormer,
        label: "Gaia Former",
        plural: "Gaia Formers",
        color: "--rt-gaia",
        weight: 0,
      },
    ],
  } as SimpleSourceFactory<SimpleSource<Building>>,
  {
    family: ChartFamily.research,
    name: "Research",
    resourceIcon: Resource.Knowledge,
    playerSummaryLineChartTitle: () => "Research steps of all players",
    showWeightedTotal: false,
    initialValue: (player, source) => initialResearch(player).get(source.type) ?? 0,
    extractLog: (cmd, source) => {
      if (cmd.command == Command.UpgradeResearch) {
        if (source.type == (cmd.args[0] as ResearchField)) {
          return 1;
        }
      }
      return 0;
    },
    sources: Object.keys(researchNames).map((field) => {
      return {
        type: field as ResearchField,
        label: researchNames[field],
        plural: `Research Steps in ${researchNames[field]}`,
        color: `--rt-${field}`,
        weight: 1,
      };
    }),
  } as SimpleSourceFactory<SimpleSource<ResearchField>>,
  {
    family: ChartFamily.planets,
    name: "Planets",
    resourceIcon: Resource.Planet,
    playerSummaryLineChartTitle: () => "Planets of all players",
    showWeightedTotal: false,
    extractLog: planetCounter((t) => [t]),
    sources: Object.keys(planetNames).map((t) => {
      const planet = t as Planet;
      return {
        type: planet,
        label: planetNames[planet],
        plural: `${planetNames[planet]} planets`,
        color: planetColor(planet, true),
        weight: 1,
      };
    }),
  } as SimpleSourceFactory<SimpleSource<Planet>>,
  {
    family: ChartFamily.terraforming,
    name: "Terraforming Steps",
    showWeightedTotal: true,
    resourceIcon: Resource.TerraformCostDiscount,
    resourceIconQuantity: 3,
    playerSummaryLineChartTitle: () => "Terraforming Steps of all players (Gaia planets and gaia formers excluded)",
    extractLog: planetCounter((type, player) => planetsForSteps(type, player.planet)),
    sources: Object.values(TerraformingSteps).map((steps) => ({
      type: steps,
      label: steps,
      plural: steps,
      color: (player) => planetColor(planetsForSteps(steps, player.planet)[0], true),
      weight: terraformingSteps(steps),
    })),
  } as SimpleSourceFactory<SimpleSource<TerraformingSteps>>,
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
  return sources.map((s) => {
    const initialValue = factory.initialValue?.(pl, s) ?? 0;
    const extractChange = factory.extractChange?.(pl, s) ?? (() => 0);
    const extractLog =
      factory.extractLog == null ? () => 0 : logEntryProcessor(pl, (cmd) => factory.extractLog(cmd, s, data, pl));
    const deltaForEnded = () => 0;

    return {
      backgroundColor: new ColorVar(resolveColor(s.color, pl)),
      label: s.label,
      fill: false,
      getDataPoints: () =>
        getDataPoints(data, initialValue, extractChange, extractLog, () => 0, deltaForEnded, includeRounds),
      weight: s.weight,
    };
  });
}

export function simpleSourceFactory<Type extends SimpleChartKind, Source extends SimpleSource<Type>>(
  family: ChartFamily
): SimpleSourceFactory<Source> {
  return factories.find((f) => f.family == family) as SimpleSourceFactory<Source>;
}

export function simpleChartTypes<Type extends SimpleChartKind, Source extends SimpleSource<Type>>(
  current: ChartFamily,
  ...want: ChartFamily[]
): Type[] {
  return want.includes(current) ? simpleSourceFactory<Type, Source>(current).sources.map((s) => s.type) : [];
}
