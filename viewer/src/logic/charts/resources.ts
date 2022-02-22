import {BoardAction, Booster, Command, Faction, Planet, Resource, Reward} from "@gaia-project/engine";
import {sum} from "lodash";
import {boardActionData} from "../../data/actions";
import {boosterData} from "../../data/boosters";
import {resourceData} from "../../data/resources";
import {colorCodes} from "../color-codes";
import {ChartSource} from "./charts";
import {ChartSummary, commandCounterArg0EqualsSource, ExtractLog, planetCounter, SimpleSourceFactory,} from "./simple-charts";

const range = "range";

export type ResourceSource = ChartSource<Resource>;
type FreeActionSource = ChartSource<Resource | "range">;

type ResourceWeight = { type: Resource; weight: number };
const resourceWeights: ResourceWeight[] = [
  {
    type: Resource.Credit,
    weight: 1,
  },
  {
    type: Resource.Ore,
    weight: 3,
  },
  {
    type: Resource.Knowledge,
    weight: 4,
  },
  {
    type: Resource.Qic,
    weight: 4,
  },
  {
    type: Resource.ChargePower,
    weight: 0,
  },
  {
    type: Resource.GainToken,
    weight: 0,
  },
];

export const resourceSources: ResourceSource[] = resourceWeights.map((w) => {
  const d = resourceData[w.type];
  return {
    type: w.type,
    weight: w.weight,
    color: d.color,
    label: d.plural,
  } as ResourceSource;
});

const freeActionSources = (resourceSources as FreeActionSource[])
  .filter((s) => s.weight > 0 || s.type == Resource.GainToken)
  .concat({
    type: range,
    label: "Range +2",
    color: colorCodes.range.color,
    weight: 0,
  })
  .concat({
    type: Resource.TechTile,
    label: "Tech Tile (Itars)",
    color: "--tech-tile",
    weight: 0,
  });

export const freeActionSourceFactory: SimpleSourceFactory<FreeActionSource> = {
  name: "Free actions",
  playerSummaryLineChartTitle:
    "Resources bought with free actions by all players (paid with power, credits, ore, QIC, and gaia formers)",
  summary: ChartSummary.weightedTotal,
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
  summary: ChartSummary.total,
  extractLog: commandCounterArg0EqualsSource(Command.Action),
  sources: BoardAction.values().map((action) => ({
    type: action,
    label: boardActionData[action].name,
    color: boardActionData[action].color,
    weight: 1,
  })),
};

export const boosterSourceFactory = (boosters: Booster[]): SimpleSourceFactory<ChartSource<Booster>> => ({
  name: "Boosters",
  summary: ChartSummary.total,
  playerSummaryLineChartTitle: "Boosters taken by all players",
  extractLog: commandCounterArg0EqualsSource(Command.Pass, Command.ChooseRoundBooster),
  sources: boosters.map((b) => ({
    type: b,
    label: boosterData[b].name,
    color: boosterData[b].color,
    weight: 1,
  })),
});
