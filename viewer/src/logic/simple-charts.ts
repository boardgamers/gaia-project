import Engine, {
  Building,
  Command,
  Faction,
  Planet,
  Player,
  PlayerEnum,
  ResearchField,
  Resource,
} from "@gaia-project/engine";
import { ChartConfiguration, ChartDataset } from "chart.js";
import { planetsWithSteps } from "../data/factions";
import { planetNames } from "../data/planets";
import {
  ChartFamily,
  chartPlayerOrder,
  DatasetFactory,
  EventFilter,
  getDataPoints,
  IncludeRounds,
  initialResearch,
  lineChartConfig,
  logEntryProcessor,
  planetColor,
  playerColor,
  playerLabel,
  weightedSum,
} from "./charts";
import { CommandObject } from "./recent";

export enum TerraformingSteps {
  Step0 = "home world",
  Step1 = "1 step",
  Step2 = "2 steps",
  Step3 = "3 steps",
  GaiaFormer = "Gaia Former",
  Gaia = "Gaia Planet (settled directly)",
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

export function planetsForSteps(type: TerraformingSteps, planet: Planet) {
  switch (type) {
    case TerraformingSteps.Gaia:
      return [Planet.Gaia];
    case TerraformingSteps.GaiaFormer:
      return [Planet.Transdim];
    case TerraformingSteps.Step0:
      return [planet];
    default:
      return planetsWithSteps(planet, terraformingSteps(type));
  }
}

export type SimpleChartKind = ResourceKind | Building | ResearchField | Planet | TerraformingSteps;

export type SimpleSource<Type extends SimpleChartKind> = {
  type: Type;
  label: string;
  plural: string;
  color: (player: Player) => string;
  weight: number;
};

export type SimpleSourceFactory<Source extends SimpleSource<any>> = {
  family: ChartFamily;
  name: string;
  playerSummaryLineChartTitle: (sources: Source[]) => string;
  sources: Source[];
  initialValue?: (player: Player, source: Source) => number;
  extractChange?: (player: Player, source: Source) => EventFilter;
  extractLog?: (cmd: CommandObject, source: Source, data: Engine, player: Player) => number;
};

export type ResourceKind = Resource | "pay-pw" | "burn-t";

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

  return (cmd, source, data: Engine, player: Player) => {
    if (cmd.command == Command.Build) {
      const building = cmd.args[0] as Building;
      const location = cmd.args[1];
      const { q, r } = data.map.parse(location);
      const hex = data.map.grid.get({ q, r });
      const planet = hex.data.planet;

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

const factories = [
  {
    family: ChartFamily.resources,
    name: "Resources",
    playerSummaryLineChartTitle: (sources) =>
      `Resources of all players as if bought with power (${sources
        .filter((s) => s.weight > 0)
        .map((s) => `${s.label}=${s.weight}`)
        .join(", ")})`,
    extractChange: (wantPlayer, source) => (player, eventSource, resource, round, change) =>
      player == wantPlayer.player &&
      ((resource == source.type && change > 0) || (resource == source.inverseOf && change < 0))
        ? Math.abs(change)
        : 0,
    extractLog: (cmd, source) => {
      if (source.type == "burn-t" && cmd.command == Command.BurnPower) {
        return Number(cmd.args[0]);
      }
      return 0;
    },
    sources: [
      {
        type: Resource.Credit,
        label: "Credit",
        plural: "Credits",
        color: () => "--res-credit",
        weight: 1,
      },
      {
        type: Resource.Ore,
        label: "Ore",
        plural: "Ores",
        color: () => "--res-ore",
        weight: 3,
      },
      {
        type: Resource.Knowledge,
        label: "Knowledge",
        plural: "Knowledge",
        color: () => "--res-knowledge",
        weight: 4,
      },
      {
        type: Resource.Qic,
        label: "QIC",
        plural: "QICs",
        color: () => "--res-qic",
        weight: 4,
      },
      {
        type: Resource.ChargePower,
        label: "Power Charges",
        plural: "Power Charges",
        color: () => "--res-power",
        weight: 0,
      },
      {
        type: "pay-pw",
        inverseOf: Resource.ChargePower,
        label: "Spent Power",
        plural: "Spent Power",
        color: () => "--lost",
        weight: 0,
      },
      {
        type: Resource.GainToken,
        label: "Gained Tokens",
        plural: "Gained Tokens",
        color: () => "--recent",
        weight: 0,
      },
      {
        type: "burn-t",
        label: "Burned Tokens",
        plural: "Burned Tokens",
        color: () => "--current-round",
        weight: 0,
      },
    ],
  } as SimpleSourceFactory<SimpleSource<ResourceKind> & { inverseOf?: Resource }>,
  {
    family: ChartFamily.buildings,
    name: "Buildings",
    playerSummaryLineChartTitle: () => "Power value of all buildings of all players (1-3 base power value)",
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
        color: () => "--res-ore",
        weight: 1,
      },
      {
        type: Building.TradingStation,
        label: "Trading Station",
        plural: "Trading Stations",
        color: () => "--res-credit",
        weight: 2,
      },
      {
        type: Building.ResearchLab,
        label: "Research Lab",
        plural: "Research Labs",
        color: () => "--res-knowledge",
        weight: 2,
      },
      {
        type: Building.PlanetaryInstitute,
        label: "Planetary Institute",
        plural: "Planetary Institutes",
        color: () => "--current-round",
        weight: 3,
      },
      {
        type: Building.Academy1,
        label: "Academy",
        plural: "Academies",
        color: () => "--rt-terra",
        weight: 3,
      },
      {
        type: Building.GaiaFormer,
        label: "Gaia Former",
        plural: "Gaia Formers",
        color: () => "--rt-gaia",
        weight: 0,
      },
    ],
  } as SimpleSourceFactory<SimpleSource<Building>>,
  {
    family: ChartFamily.research,
    name: "Research",
    playerSummaryLineChartTitle: () => "Research steps of all players",
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
        color: () => `--rt-${field}`,
        weight: 1,
      };
    }),
  } as SimpleSourceFactory<SimpleSource<ResearchField>>,
  {
    family: ChartFamily.planets,
    name: "Planets",
    playerSummaryLineChartTitle: () => "Planets of all players",
    extractLog: planetCounter((t) => [t]),
    sources: Object.keys(planetNames).map((t) => {
      const planet = t as Planet;
      return {
        type: planet,
        label: planetNames[planet],
        plural: `${planetNames[planet]} planets`,
        color: () => planetColor(planet, true),
        weight: 1,
      };
    }),
  } as SimpleSourceFactory<SimpleSource<Planet>>,
  {
    family: ChartFamily.terraforming,
    name: "Terraforming Steps",
    playerSummaryLineChartTitle: () => "Terraforming Steps of all players (Gaia planets and gaia formers excluded)",
    extractLog: planetCounter((type, player) => planetsForSteps(TerraformingSteps[type], player.planet)),
    sources: Object.keys(TerraformingSteps).map((t) => {
      const steps = TerraformingSteps[t];
      return {
        type: t,
        label: steps,
        plural: steps,
        color: (player) => planetColor(planetsForSteps(steps, player.planet)[0], true),
        weight: terraformingSteps(steps),
      };
    }),
  } as SimpleSourceFactory<SimpleSource<TerraformingSteps>>,
];

function simpleChartDetails<Source extends SimpleSource<any>>(
  factory: SimpleSourceFactory<Source>,
  data: Engine,
  player: PlayerEnum,
  canvas: HTMLCanvasElement,
  sources: Source[],
  includeRounds: IncludeRounds
): DatasetFactory[] {
  const pl = data.player(player);
  if (!pl.faction) {
    return [];
  }
  const style = window.getComputedStyle(canvas);

  return sources.map((s) => {
    const stringColor = s.color(pl);
    const color = stringColor.startsWith("--") ? style.getPropertyValue(stringColor) : stringColor;

    const initialValue = factory.initialValue?.(pl, s) ?? 0;
    const extractChange = factory.extractChange?.(pl, s) ?? (() => 0);
    const extractLog =
      factory.extractLog == null ? () => 0 : logEntryProcessor(pl, (cmd) => factory.extractLog(cmd, s, data, pl));
    const deltaForEnded = () => 0;

    return {
      backgroundColor: color,
      label: s.label,
      fill: false,
      getDataPoints: () =>
        getDataPoints(data, initialValue, extractChange, extractLog, () => 0, deltaForEnded, includeRounds),
      weight: s.weight,
    };
  });
}

function simpleChartFactory<Type extends SimpleChartKind, Source extends SimpleSource<Type>>(
  family: ChartFamily
): SimpleSourceFactory<Source> {
  return factories.find((f) => f.family == family) as SimpleSourceFactory<Source>;
}

export function simpleChartTypes<Type extends SimpleChartKind, Source extends SimpleSource<Type>>(
  current: ChartFamily,
  want: ChartFamily
): Type[] {
  if (current == want) {
    return simpleChartFactory<Type, Source>(want).sources.map((s) => s.type);
  }
  return [];
}

export function newSimpleBarChart(
  family: ChartFamily,
  data: Engine,
  canvas: HTMLCanvasElement
): ChartConfiguration<"bar"> {
  const factory = simpleChartFactory(family);
  const sources = factory.sources;
  const datasets: ChartDataset<"bar">[] = chartPlayerOrder(data)
    .filter((pl) => data.player(pl).faction != null)
    .map((pl) => {
      const points = simpleChartDetails(factory, data, pl, canvas, sources, "last").map((f) => f.getDataPoints()[0]);
      const player = data.player(pl);
      return {
        data: points,
        label: playerLabel(player),
        backgroundColor: playerColor(player, false),
        borderColor: "black",
        borderWidth: 1,
      };
    });

  return {
    type: "bar",
    data: {
      labels: sources.map((s) => s.label),
      datasets: datasets,
    },
    options: {
      plugins: {
        title: {
          text: `${factory.name} of all players`,
          display: true,
        },
      },
      responsive: true,
    },
  };
}

export function newSimpleLineChart(
  family: ChartFamily,
  data: Engine,
  canvas: HTMLCanvasElement,
  kind: PlayerEnum | SimpleChartKind
): ChartConfiguration<"line"> {
  const factory = simpleChartFactory(family);
  const allSources = factory.sources;
  let title: string;
  let factories: DatasetFactory[];
  if (typeof kind == "number") {
    const numbers = kind === PlayerEnum.All ? chartPlayerOrder(data) : [kind as PlayerEnum];

    if (numbers.length == 1) {
      const player = numbers[0];
      title = `${factory.name} of ${playerLabel(data.player(player))}`;
      factories = simpleChartDetails(factory, data, player, canvas, allSources, "except-final");
    } else {
      title = factory.playerSummaryLineChartTitle(allSources);
      factories = numbers.map((p) =>
        weightedSum(data, p, canvas, simpleChartDetails(factory, data, p, canvas, allSources, "except-final"))
      );
    }
  } else {
    const sources = allSources.filter((r) => r.type === kind);

    title = `${sources[0].plural} of all players`;
    factories = chartPlayerOrder(data).map((p) => {
      const pl = data.player(p);
      if (!pl.faction) {
        return null;
      }

      return {
        backgroundColor: playerColor(pl, true),
        label: playerLabel(pl),
        fill: false,
        getDataPoints: () => simpleChartDetails(factory, data, p, canvas, sources, "except-final")[0].getDataPoints(),
        weight: 1,
      };
    });
  }

  return lineChartConfig(
    title,
    canvas,
    data,
    factories.filter((f) => f != null),
    false,
    "except-final"
  );
}
