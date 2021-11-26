import { BoardAction, Booster, Command, Faction, Planet, Resource, Reward } from "@gaia-project/engine";
import { sum } from "lodash";
import { boardActionNames } from "../../data/actions";
import { boosterNames } from "../../data/boosters";
import { resourceNames } from "../../data/resources";
import { terranChargeExtractLog, useChargedTokensExtractLog } from "./charge";
import { ChartKind } from "./chart-factory";
import { ChartSource, extractChanges } from "./charts";
import { nevlasPowerLeverage, powerLeverage, powerLeverageSource, taklonsPowerLeverage } from "./power-leverage";
import { commandCounterArg0EqualsSource, ExtractLog, planetCounter, SimpleSourceFactory } from "./simple-charts";

const range = "range";

class BaseResourceSource<T extends ChartKind> extends ChartSource<T> {
  inverseOf?: Resource;
}

export type ResourceSource = BaseResourceSource<Resource | "powerLeverage">;
type FreeActionSource = BaseResourceSource<Resource | "range">;

type ResourceWeight = { type: Resource; color: string; weight: number; inverseOf?: Resource };
const resourceWeights: ResourceWeight[] = [
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

export const resourceSources: ResourceSource[] = resourceWeights
  .map((w) => {
    const n = resourceNames.find((n) => n.type == w.type);
    return {
      type: w.type,
      weight: w.weight,
      color: w.color,
      inverseOf: w.inverseOf,
      label: n.plural,
    } as ResourceSource;
  })
  .concat(powerLeverageSource);

const freeActionSources = (resourceSources as FreeActionSource[])
  .filter((s) => s.weight > 0 || s.type == Resource.GainToken)
  .concat({
    type: range,
    label: "Range +2",
    color: "--rt-nav",
    weight: 0,
  })
  .concat({
    type: Resource.TechTile,
    label: "Tech Tile (Itars)",
    color: "--tech-tile",
    weight: 0,
  });

export const resourceSourceFactory: SimpleSourceFactory<ResourceSource> = {
  name: "Resources",
  playerSummaryLineChartTitle: "Resources of all players as if bought with power",
  showWeightedTotal: true,
  extractChange: (wantPlayer, source) =>
    extractChanges(wantPlayer.player, (player, eventSource, resource, round, change) =>
      (resource == source.type && change > 0) || (resource == source.inverseOf && change < 0) ? Math.abs(change) : 0
    ),
  extractLog: ExtractLog.mux([
    {
      sourceTypeFilter: [Resource.BurnToken],
      commandFilter: [Command.BurnPower],
      extractLog: ExtractLog.filterPlayer((e) => Number(e.cmd.args[0])),
    },
    terranChargeExtractLog(Resource.ChargePower),
    useChargedTokensExtractLog(Resource.ChargePower),
    {
      factionFilter: [Faction.Taklons],
      sourceTypeFilter: [powerLeverage],
      extractLog: taklonsPowerLeverage(2),
    },
    {
      factionFilter: [Faction.Nevlas],
      sourceTypeFilter: [powerLeverage],
      extractLog: nevlasPowerLeverage,
    },
  ]),
  sources: resourceSources,
};

export const freeActionSourceFactory: SimpleSourceFactory<FreeActionSource> = {
  name: "Free actions",
  playerSummaryLineChartTitle:
    "Resources bought with free actions by all players (paid with power, credits, ore, QIC, and gaia formers)",
  showWeightedTotal: true,
  extractLog: ExtractLog.mux([
    {
      commandFilter: [Command.Spend],
      extractLog: ExtractLog.filterPlayer((e) =>
        sum(
          Reward.merge(Reward.parse(e.cmd.args[2]))
            .filter((i) => i.type == e.source.type)
            .map((i) => i.count)
        )
      ),
    },
    {
      commandFilter: [Command.Build],
      extractLog: planetCounter(
        () => false,
        () => false,
        (p, t) => t == range,
        true,
        (cmd, log, planet) =>
          -(log.changes?.[Command.Build]?.[Resource.Qic] ?? 0) -
          (planet == Planet.Gaia && cmd.faction != Faction.Gleens ? 1 : 0)
      ),
    },
  ]),
  sources: freeActionSources,
};

export const boardActionSourceFactory: SimpleSourceFactory<ChartSource<BoardAction>> = {
  name: "Board actions",
  playerSummaryLineChartTitle: `Board actions taken by all players`,
  showWeightedTotal: false,
  extractLog: commandCounterArg0EqualsSource(Command.Action),
  sources: BoardAction.values().map((action) => ({
    type: action,
    label: boardActionNames[action].name,
    color: boardActionNames[action].color,
    weight: 1,
  })),
};

export const boosterSourceFactory = (boosters: Booster[]): SimpleSourceFactory<ChartSource<Booster>> => ({
  name: "Boosters",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Boosters taken by all players",
  extractLog: commandCounterArg0EqualsSource(Command.Pass, Command.ChooseRoundBooster),
  sources: boosters.map((b) => ({
    type: b,
    label: boosterNames[b].name,
    color: boosterNames[b].color,
    weight: 1,
  })),
});
