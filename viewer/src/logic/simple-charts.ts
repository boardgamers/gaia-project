import Engine, {
  BoardAction,
  Booster,
  Building,
  Command,
  Faction,
  Federation,
  federations,
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
import { boardActionNames } from "../data/board-actions";
import { boosterNames } from "../data/boosters";
import { planetsWithSteps } from "../data/factions";
import { federationColors } from "../data/federations";
import { planetNames } from "../data/planets";
import { researchNames } from "../data/research";
import { baseTechTileNames } from "../data/tech-tiles";
import {
  ChartColor,
  ChartFamily,
  DatasetFactory,
  extractChanges,
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
  plural: string;
  color: ChartColor;
  weight: number;
};

export type SimpleSourceFactory<Source extends SimpleSource<any>> = {
  name: ChartFamily;
  playerSummaryLineChartTitle: (sources: Source[]) => string;
  sources: Source[];
  showWeightedTotal: boolean;
  initialValue?: (player: Player, source: Source) => number;
  extractChange?: (player: Player, source: Source) => (entry: LogEntry) => number;
  extractLog?: (cmd: CommandObject, source: Source, data: Engine, player: Player, log: LogEntry) => number;
};

function commandCounter<T>(...want: Command[]): (cmd: CommandObject, source: SimpleSource<T>) => number {
  return (cmd, source) => (want.includes(cmd.command) && (cmd.args[0] as any) == source.type ? 1 : 0);
}

function extractLogMux<T>(
  mux: {
    [key in Command]?: (
      cmd: CommandObject,
      source: SimpleSource<T>,
      data: Engine,
      player: Player,
      log: LogEntry
    ) => number;
  }
): (cmd: CommandObject, source: SimpleSource<T>, data: Engine, player: Player, log: LogEntry) => number {
  return (cmd, source, data, player, log) => mux[cmd.command]?.(cmd, source, data, player, log) ?? 0;
}

function planetCounter<T>(
  isLantidsGuestMine: (s: SimpleSource<T>) => boolean,
  isLostPlanet: (s: SimpleSource<T>) => boolean,
  includePlanet: (planet: Planet, type: T, player: Player) => boolean,
  value: (cmd: CommandObject, log: LogEntry, planet: Planet) => number = () => 1
): (cmd: CommandObject, source: SimpleSource<T>, data: Engine, player: Player, log: LogEntry) => number {
  const transdim = new Set<string>();
  const owners: { [key: string]: PlayerEnum } = {};

  return (cmd, source, data: Engine, player: Player, log: LogEntry) => {
    if (cmd.command == Command.PlaceLostPlanet && isLostPlanet(source)) {
      return 1;
    }
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
        return isLantidsGuestMine(source) ? 1 : 0;
      }

      if (building == Building.GaiaFormer) {
        transdim.add(location);

        if (includePlanet(Planet.Transdim, source.type, player)) {
          return value(cmd, log, planet);
        }
      }

      if (
        includePlanet(planet, source.type, player) &&
        (building == Building.Mine || (building == Building.PlanetaryInstitute && player.faction == Faction.Ivits)) &&
        !transdim.has(location)
      ) {
        return value(cmd, log, planet);
      }
    }
    return 0;
  };
}

type ResourceSource = SimpleSource<Resource | "pay-pw" | "burn-token" | "range"> & { inverseOf?: Resource };

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
    type: "pay-pw",
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
    type: "burn-token",
    label: "Burned Tokens",
    plural: "Burned Tokens",
    color: "--current-round",
    weight: 0,
  },
];

const freeActionSources = resourceSources
  .filter((s) => s.weight > 0 || s.type == Resource.GainToken)
  .concat({
    type: "range",
    label: "Range +2",
    plural: "Range +2",
    color: "--rt-nav",
    weight: 0,
  });

function federationName(logEntry: LogEntry): string | null {
  const f = logEntry.changes[Command.FormFederation];
  if (f == null) {
    return null;
  }

  const name = Object.keys(f)
    .filter((r) => r != Resource.GainToken)
    .map((r) => f[r] + r)
    .join(",");
  switch (name) {
    case "8vp":
      return "8vp,2t";
    case "8vp,1q":
      return "8vp,q";
    case "1o,1k,2c":
      return "Gleens";
  }
  return name;
}

const factories = [
  {
    name: "Resources",
    playerSummaryLineChartTitle: () => "Resources of all players as if bought with power",
    showWeightedTotal: true,
    extractChange: (wantPlayer, source) =>
      extractChanges(wantPlayer.player, (player, eventSource, resource, round, change) =>
        (resource == source.type && change > 0) || (resource == source.inverseOf && change < 0) ? Math.abs(change) : 0
      ),
    extractLog: (cmd, source) =>
      source.type == "burn-token" && cmd.command == Command.BurnPower ? Number(cmd.args[0]) : 0,
    sources: resourceSources,
  } as SimpleSourceFactory<ResourceSource>,
  {
    name: "Free actions",
    playerSummaryLineChartTitle: () =>
      "Resources bought with free actions by all players (paid with power, credits, ore, QIC, and gaia formers)",
    showWeightedTotal: true,
    extractLog: extractLogMux({
      [Command.Spend]: (cmd: CommandObject, source: ResourceSource) =>
        sum(
          Reward.merge(Reward.parse(cmd.args[2]))
            .filter((i) => i.type == source.type)
            .map((i) => i.count)
        ),
      [Command.Build]: planetCounter(
        () => false,
        () => false,
        (p, t) => t == "range",
        (cmd, log, planet) =>
          -(log.changes?.[Command.Build]?.[Resource.Qic] ?? 0) -
          (planet == Planet.Gaia && cmd.faction != Faction.Gleens ? 1 : 0)
      ),
    }),
    sources: freeActionSources,
  } as SimpleSourceFactory<ResourceSource | SimpleSource<"range">>,
  {
    name: "Board actions",
    playerSummaryLineChartTitle: () => `Board actions taken by all players`,
    showWeightedTotal: false,
    extractLog: commandCounter(Command.Action),
    sources: BoardAction.values().map((action) => ({
      type: action,
      label: boardActionNames[action].name,
      plural: boardActionNames[action].name,
      color: boardActionNames[action].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<BoardAction>>,
  {
    name: "Buildings",
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
    name: "Research",
    playerSummaryLineChartTitle: () => "Research steps of all players",
    showWeightedTotal: false,
    initialValue: (player, source) => initialResearch(player).get(source.type) ?? 0,
    extractLog: commandCounter(Command.UpgradeResearch),
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
    name: "Planets",
    playerSummaryLineChartTitle: () => "Planets of all players",
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
          label: planetNames[planet],
          plural: `${planetNames[planet]} planets`,
          color: planetColor(planet, true),
          weight: 1,
        };
      })
      .concat({
        type: Planet.Empty,
        label: "Lantids guest mine",
        plural: "Lantids guest mines",
        color: "--recent",
        weight: 1,
      }),
  } as SimpleSourceFactory<SimpleSource<Planet>>,
  {
    name: "Terraforming Steps",
    showWeightedTotal: true,
    playerSummaryLineChartTitle: () => "Terraforming Steps of all players (Gaia planets and gaia formers excluded)",
    extractLog: planetCounter(
      (source) => source.type == TerraformingSteps.Lantids,
      (source) => source.type == TerraformingSteps.LostMine,
      (p, type, player) => planetsForSteps(type, player.planet).includes(p)
    ),
    sources: Object.values(TerraformingSteps).map((steps) => ({
      type: steps,
      label: steps,
      plural: steps,
      color: (player) => planetColor(planetsForSteps(steps, player.planet)[0], true),
      weight: terraformingSteps(steps),
    })),
  } as SimpleSourceFactory<SimpleSource<TerraformingSteps>>,
  {
    name: "Boosters",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: () => "Boosters taken by all players",
    extractLog: commandCounter(Command.Pass, Command.ChooseRoundBooster),
    sources: Booster.values().map((b) => ({
      type: b,
      label: boosterNames[b].name,
      plural: boosterNames[b].name,
      color: boosterNames[b].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<Booster>>,
  {
    name: "Federations",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: () => "Federations of all players",
    extractChange: (wantPlayer, source) => (logItem: LogEntry) =>
      logItem.player == wantPlayer.player && federationName(logItem) == source.label ? 1 : 0,
    sources: Federation.values()
      .map((f) => ({
        type: f,
        label: federations[f],
        plural: federations[f],
        color: federationColors[f],
        weight: 1,
      }))
      .concat({
        type: Federation.Gleens,
        label: "Gleens",
        plural: "Gleens",
        color: "--desert",
        weight: 1,
      }),
  } as SimpleSourceFactory<SimpleSource<Federation>>,
  {
    name: "Base Tech Tiles",
    showWeightedTotal: false,
    playerSummaryLineChartTitle: () => "Base Tech tiles of all players",
    extractLog: (cmd, source, data) => {
      if (cmd.command == Command.ChooseTechTile) {
        const pos = cmd.args[0] as TechTilePos;
        const tile = data.tiles.techs[pos].tile;

        if (tile == source.type) {
          return 1;
        }
      }
      return 0;
    },
    sources: TechTile.values().map((t) => ({
      type: t,
      label: baseTechTileNames[t].name,
      plural: baseTechTileNames[t].name,
      color: baseTechTileNames[t].color,
      weight: 1,
    })),
  } as SimpleSourceFactory<SimpleSource<TechTile>>,
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
      factory.extractLog == null
        ? () => 0
        : logEntryProcessor(pl, (cmd, log) => factory.extractLog(cmd, s, data, pl, log));
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
