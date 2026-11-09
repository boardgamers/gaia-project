import {
  BoardAction,
  Booster,
  Command,
  Expansion,
  Faction,
  Planet,
  Resource,
  Reward,
  Spaceship,
} from "@gaia-project/engine";
import type { SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import { spaceshipBoards } from "@gaia-project/engine/src/spaceships";
import { boardActionData } from "../../data/actions";
import { boosterData } from "../../data/boosters";
import { resourceData } from "../../data/resources";
import { spaceshipColors, spaceshipNames } from "../../data/spaceships";
import { colorCodes } from "../color-codes";
import { sum } from "../lodash-utils";
import type { ChartSource } from "./charts";
import type { SimpleSourceFactory } from "./simple-charts";
import { ChartSummary, commandCounterArg0EqualsSource, ExtractLog, planetCounter } from "./simple-charts";

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

const shipActionLabels: Record<Spaceship, Partial<Record<SpaceshipActionType, string>>> = {
  [Spaceship.Twilight]: { qic: "Re-score federation", power: "Research lab", knowledge: "Range +3" },
  [Spaceship.Rebellion]: { qic: "Tech tile", power: "Trading station", knowledge: "2 credits + 1 QIC" },
  [Spaceship.TFMars]: { qic: "VP for tech tiles", power: "Instant Gaiaforming", credit: "1 step + mine" },
  [Spaceship.Eclipse]: { qic: "VP for planet types", power: "Research advance", credit: "Asteroid mine" },
};

export const boardActionSourceFactory = (expansion: Expansion): SimpleSourceFactory<ChartSource<string>> => ({
  name: "Board actions",
  playerSummaryLineChartTitle: `Board actions taken by all players`,
  summary: ChartSummary.total,
  // Count the action command, not its resource changes or follow-up commands
  // (tech tile, research, federation reward, build, etc.). Ship and action together
  // identify a row: every ship has a QIC action, but they do different things.
  extractLog: ExtractLog.filterPlayer(({ cmd, source }) => {
    if (cmd.command === Command.Action) {
      return cmd.args[0] === source.type ? 1 : 0;
    }
    if (cmd.command === Command.SpaceshipAction) {
      return `spaceshipAction:${cmd.args[0]}:${cmd.args[1]}` === source.type ? 1 : 0;
    }
    return 0;
  }),
  sources: BoardAction.values()
    .map((action): ChartSource<string> => ({
      type: action,
      label: boardActionData[action].name,
      color: boardActionData[action].color,
      weight: 1,
    }))
    .concat(
      Spaceship.values(expansion).flatMap((ship) =>
        spaceshipBoards[ship].actions.map((action) => ({
          type: `spaceshipAction:${ship}:${action.type}`,
          label: `${spaceshipNames[ship]}: ${shipActionLabels[ship][action.type]}`,
          description: `${spaceshipNames[ship]}: ${action.effect} (cost: ${action.cost})`,
          color: spaceshipColors[ship],
          weight: 1,
        }))
      )
    ),
});

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
