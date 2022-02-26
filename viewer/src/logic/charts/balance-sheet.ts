import {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  boardActions,
  Booster,
  Command,
  Event,
  EventSource,
  Expansion,
  Faction,
  Federation,
  freeActionConversions,
  Phase,
  PlayerData,
  PowerArea,
  ResearchField,
  Resource,
  Reward,
  TechPos,
  TechTile,
} from "@gaia-project/engine";
import { UPGRADE_RESEARCH_COST } from "@gaia-project/engine/src/available/types";
import { AnyTechTile, AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { tradeCostSource, tradeSource } from "@gaia-project/engine/src/events";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { techTileEventSource, techTileRewards } from "@gaia-project/engine/src/tiles/techs";
import { sum, uniq } from "lodash";
import { resourceData } from "../../data/resources";
import { colorCodes } from "../color-codes";
import { ChartGroup, ChartSource } from "./charts";
import { resourceCounter, ResourceSimulatorChanges } from "./resource-counter";
import { ChartSummary, ExtractLog, SimpleSourceFactory } from "./simple-charts";

export const balanceSheetResources = [
  Resource.Credit,
  Resource.Ore,
  Resource.Knowledge,
  Resource.Qic,
  Resource.ChargePower,
  Resource.GainToken,
];

const waste = "Waste";

enum PowerChargeSource {
  freeLeech = "freeLeech",
  paidLeech = "paidLeech",
  powerLeverage = "powerLeverage",
}

export type BalanceSheetSourceType = EventSource | typeof waste | PowerChargeSource;

export type BalanceSheetSourceTemplate = {
  incomeResources: Resource[];
  costResources: Resource[];
  label: string;
  description?: string;
  color: string;
  eventSources: BalanceSheetSourceType[];
};

class BalanceSheetSource extends ChartSource<string> {
  eventSources: BalanceSheetSourceType[];
}

function rewardTypes(rewards: Reward[]): Resource[] {
  return uniq(rewards.flatMap((r) => r.type).filter((t) => balanceSheetResources.includes(t)));
}

function eventTypes(events: Event[]): Resource[] {
  return rewardTypes(events.flatMap((e) => e.rewards));
}

export function balanceSheetEventSources(expansion: Expansion): BalanceSheetSourceTemplate[] {
  return ([
    {
      label: "Game start",
      costResources: [],
      incomeResources: balanceSheetResources,
      eventSources: [Phase.BeginGame],
      color: "--gaia",
    },
    {
      label: "Base",
      costResources: [],
      incomeResources: balanceSheetResources,
      eventSources: [Command.ChooseIncome],
      color: "--res-credit",
    },
    {
      label: "Faction abilities",
      costResources: [],
      incomeResources: [Resource.Knowledge],
      eventSources: Object.values(Faction),
      color: "--volcanic",
    },
    {
      label: "Tech Tiles",
      description: "Tech Tiles income, including the free 4k for the free research step when gained",
      costResources: [],
      incomeResources: rewardTypes(
        (TechTile.values(expansion) as AnyTechTile[])
          .concat(AdvTechTile.values(expansion))
          .flatMap((t) => techTileRewards(t))
      ),
      eventSources: (TechPos.values(expansion) as (TechPos | AdvTechTilePos)[]).concat(
        AdvTechTilePos.values(expansion)
      ),
      color: "--current-round",
    },
    {
      label: "Research",
      costResources: [Resource.Knowledge],
      incomeResources: balanceSheetResources,
      eventSources: (ResearchField.values(expansion) as EventSource[]).concat(Command.UpgradeResearch),
      color: colorCodes.researchStep.color,
    },
    {
      label: "Booster",
      costResources: [],
      incomeResources: eventTypes(Booster.values(expansion).flatMap((b) => boosterEvents(b))),
      eventSources: Booster.values(expansion),
      color: colorCodes.booster.color,
    },
    {
      label: "Build",
      costResources: [Resource.Credit, Resource.Ore, Resource.Knowledge, Resource.Qic],
      incomeResources: [],
      eventSources: [Command.Build],
      color: "--res-ore",
    },
    {
      label: "Free actions",
      costResources: rewardTypes(Object.values(freeActionConversions).flatMap((c) => Reward.parse(c.cost))).concat(
        Resource.GainToken
      ), //for burn
      incomeResources: rewardTypes(Object.values(freeActionConversions).flatMap((c) => Reward.parse(c.income))),
      eventSources: [Command.Spend],
      color: "--res-power",
    },
    {
      label: "Power/Q.I.C Actions",
      costResources: rewardTypes(BoardAction.values(expansion).flatMap((a) => Reward.parse(boardActions[a].cost))),
      incomeResources: eventTypes(
        BoardAction.values(expansion).flatMap((a) => Event.parse(boardActions[a].income, null))
      ),
      eventSources: BoardAction.values(),
      color: "--specialAction",
    },
    {
      label: "Free Leech",
      incomeResources: [Resource.ChargePower, Resource.GainToken],
      costResources: [],
      eventSources: [PowerChargeSource.freeLeech],
      color: "--res-power",
    },
    {
      label: "Paid Leech",
      incomeResources: [Resource.ChargePower, Resource.GainToken],
      costResources: [],
      eventSources: [PowerChargeSource.paidLeech],
      color: "--res-qic",
    },
    {
      label: "Powerful Power Tokens",
      incomeResources: [Resource.ChargePower],
      costResources: [],
      eventSources: [PowerChargeSource.powerLeverage],
      color: "--tech-tile",
    },
    {
      label: "Terrans",
      description: "Tokens are moved from the gaia area to area 2",
      incomeResources: [Resource.ChargePower],
      costResources: [],
      eventSources: [Faction.Terrans],
      color: "--terra",
    },
    {
      label: "Federations",
      costResources: [Resource.GainToken, Resource.Qic],
      incomeResources: rewardTypes(Federation.values(expansion).flatMap((f) => federationRewards(f))),
      eventSources: [Command.FormFederation],
      color: "--federation",
    },
    {
      label: "Waste",
      description: "Also includes tye use of tokens in area2 or area3 for gaia forming or forming federations",
      costResources: balanceSheetResources,
      incomeResources: [],
      eventSources: [waste],
      color: "--res-qic",
    },
  ] as BalanceSheetSourceTemplate[]).concat(
    expansion == Expansion.Frontiers
      ? [
          {
            label: "Trade",
            costResources: [Resource.ChargePower],
            incomeResources: balanceSheetResources,
            eventSources: [tradeSource, tradeCostSource],
            color: colorCodes.tradeShip.color,
          },
        ]
      : []
  );
}

function isPayPower(wantResource: Resource, reward: Reward) {
  return wantResource == Resource.ChargePower && reward.type == Resource.ChargePower && reward.count < 0;
}

function effectiveAmount(reward: Reward | null, wantResource: Resource, faction: Faction): Reward | null {
  if (reward == null) {
    return null;
  }

  if (wantResource == Resource.GainToken) {
    if (reward.type == Resource.BurnToken && faction != Faction.Itars) {
      return new Reward(-reward.count, Resource.GainToken);
    }
    if (reward.type == Resource.Brainstone) {
      return new Reward(reward.count, Resource.GainToken);
    }
  }
  return reward.type == wantResource ? reward : null;
}

function resourceChanges<Source>(
  changes: ResourceSimulatorChanges,
  source: Source,
  wantResource: Resource,
  faction: Faction,
  eventSources: BalanceSheetSourceType[],
  matchesEventSource: (s: Source, e: BalanceSheetSourceType, reward: Reward) => number
): number {
  return sum(
    Object.entries(changes).flatMap((c) => {
      const eventSource = c[0] as EventSource;
      return c[1].map((reward) => {
        const r = effectiveAmount(reward, wantResource, faction);

        if (r == null || Math.abs(r.count) == 0) {
          return 0;
        }

        if (eventSource == Command.ChargePower) {
          if (wantResource == Resource.ChargePower) {
            if (eventSources.includes(PowerChargeSource.freeLeech)) {
              return 1;
            } else if (eventSources.includes(PowerChargeSource.paidLeech)) {
              return r.count - 1;
            }
            return 0;
          } else if (wantResource == Resource.GainToken) {
            const vpCost = Object.values(changes)
              .flat()
              .find((r) => r.type == Resource.VictoryPoint);
            if (eventSources.includes(PowerChargeSource.freeLeech) && vpCost == null) {
              return r.count;
            } else if (eventSources.includes(PowerChargeSource.paidLeech) && vpCost != null) {
              return r.count;
            }
            return 0;
          }
        }

        return matchesEventSource(source, eventSource, r);
      });
    })
  );
}

function newBalanceSource(
  s: BalanceSheetSourceTemplate,
  name: string,
  weight: number,
  lookup: Map<BalanceSheetSourceType, string>
): BalanceSheetSource {
  const label = `${s.label} ${name}`;
  for (const eventSource of s.eventSources) {
    lookup.set(eventSource, label);
  }
  return {
    type: label,
    label,
    description: s.description || label,
    weight,
    color: s.color,
    eventSources: s.eventSources,
  };
}

export function currentAmount(data: PlayerData, wantResource: Resource): number {
  switch (wantResource) {
    case Resource.ChargePower:
      let brainstone = 0;
      if (data.brainstone === PowerArea.Area2) {
        brainstone = 1;
      } else if (data.brainstone === PowerArea.Area3) {
        brainstone = 2;
      }
      return data.power.area2 + 2 * data.power.area3 + brainstone;
    case Resource.GainToken:
      return (
        data.power.area1 + data.power.area2 + data.power.area3 + data.power.gaia + (data.brainstone != null ? 1 : 0)
      );
  }
  return data.getResources(wantResource);
}

function gainFactor(wantResource: Resource, amount: number) {
  return wantResource == Resource.ChargePower && amount < 0 ? 2 * amount : amount;
}

export function balanceSheetExtractLog<Source>(
  getWantResource: (s: Source) => Resource,
  getSources: (s: Source) => BalanceSheetSourceType[],
  matchesEventSource: (s: Source, e: BalanceSheetSourceType, reward: Reward) => number
): ExtractLog<any> {
  return resourceCounter((want, a, data, simulateResources) => {
    const wantResource = getWantResource(a.source);
    let old = currentAmount(data, wantResource);
    const oldPower3 = data.power.area3;
    const oldBrainstone = data.brainstone;
    const changes = simulateResources();

    if (a.log.player != null && a.log.player != want.player) {
      return 0;
    }

    const eventSources = getSources(a.source);

    const payPower = Object.values(changes).some((r) => r.some((r) => isPayPower(wantResource, r)));
    if (payPower) {
      const leverage =
        oldBrainstone == PowerArea.Area3 && data.brainstone == PowerArea.Area1
          ? 4
          : 2 * (data.tokenModifier - 1) * (oldPower3 - data.power.area3);
      if (eventSources.includes(PowerChargeSource.powerLeverage)) {
        return leverage;
      }
      old += leverage;
    }

    const implicitResearchCost =
      wantResource == Resource.Knowledge &&
      a.cmd?.command == Command.ChooseTechTile &&
      (matchesEventSource(a.source, techTileEventSource(a.cmd.args[0] as AnyTechTilePos), UPGRADE_RESEARCH_COST) ||
        matchesEventSource(
          a.source,
          a.allCommands.some((c) => c.command == Command.Decline) ? waste : Command.UpgradeResearch,
          Reward.negative([UPGRADE_RESEARCH_COST])[0]
        ))
        ? UPGRADE_RESEARCH_COST.count
        : 0;

    const faction = want.faction;
    if (eventSources.includes(waste)) {
      const diff = currentAmount(data, wantResource) - old;

      const gain = sum(
        Object.values(changes)
          .flat()
          .map((r) => gainFactor(wantResource, effectiveAmount(r, wantResource, faction)?.count ?? 0))
      );

      const waste = gain - diff;

      if (waste < 0) {
        throw Error(
          `negative waste ${waste} in ${JSON.stringify(a.log)}: cmd=${JSON.stringify(
            a.cmd
          )} resource=${wantResource} gain=${gain} diff=${diff} old=${old} payPower=${payPower} power=${JSON.stringify(
            data.power
          )} brainstone=${data.brainstone} changes=${JSON.stringify(changes)}`
        );
      }
      return waste + implicitResearchCost;
    }
    return (
      resourceChanges(changes, a.source, wantResource, faction, eventSources, matchesEventSource) + implicitResearchCost
    );
  });
}

export function balanceSheetResourceName(wantResource: Resource) {
  return wantResource == Resource.GainToken ? "Power Tokens" : resourceData[wantResource].plural;
}

export function balanceSheetResourceFactory(
  wantResource: Resource,
  expansion: Expansion
): SimpleSourceFactory<ChartSource<string>> {
  const income = new Map<BalanceSheetSourceType, string>();
  const cost = new Map<BalanceSheetSourceType, string>();

  return {
    name: balanceSheetResourceName(wantResource),
    group: ChartGroup.resources,
    playerSummaryLineChartTitle: `Income and Expenses of ${resourceData[wantResource].plural} of all players`,
    summary: ChartSummary.balance,
    extractLog: balanceSheetExtractLog<BalanceSheetSource>(
      () => wantResource,
      (s) => s.eventSources,
      (source, eventSource, reward) => {
        const label = reward.count < 0 ? cost.get(eventSource) : income.get(eventSource);

        if (label == null) {
          throw Error(`no source found for eventSource=${eventSource} reward=${reward}`);
        }
        return source.label === label ? Math.abs(reward.count) : 0;
      }
    ),
    sources: balanceSheetEventSources(expansion)
      .filter((s) => s.incomeResources.includes(wantResource))
      .map((s) => newBalanceSource(s, "income", 1, income))
      .concat(
        balanceSheetEventSources(expansion)
          .filter((s) => s.costResources.includes(wantResource))
          .map((s) =>
            newBalanceSource(s, "cost", s.eventSources.includes(waste) ? -1 : gainFactor(wantResource, -1), cost)
          )
      ),
  };
}
