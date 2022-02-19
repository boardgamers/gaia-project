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
import { tradeCostSource, tradeSource } from "@gaia-project/engine/src/events";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { techTileRewards } from "@gaia-project/engine/src/tiles/techs";
import { sum, uniq } from "lodash";
import { isGaiaMove } from "../../data/log";
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
  terrans = "terrans",
  powerLeverage = "powerLeverage",
}

export type BalanceSheetSourceType = EventSource | typeof waste | PowerChargeSource;

type BalanceSheetSourceTemplate = {
  incomeResources: Resource[];
  costResources: Resource[];
  costFactor?: number;
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

export function balanceSheetSources(expansion: Expansion): BalanceSheetSourceTemplate[] {
  return [
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
      costResources: [],
      incomeResources: rewardTypes(
        (TechTile.values(expansion) as (TechTile | AdvTechTile)[])
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
      costFactor: 2,
      incomeResources: rewardTypes(Object.values(freeActionConversions).flatMap((c) => Reward.parse(c.income))),
      eventSources: [Command.Spend],
      color: "--res-power",
    },
    {
      label: "Power/Q.I.C Action",
      costResources: rewardTypes(BoardAction.values(expansion).flatMap((a) => Reward.parse(boardActions[a].cost))),
      costFactor: 2,
      incomeResources: eventTypes(
        BoardAction.values(expansion).flatMap((a) => Event.parse(boardActions[a].income, null))
      ),
      eventSources: BoardAction.values(),
      color: "--specialAction",
    },
    {
      label: "Free Leech",
      incomeResources: [Resource.ChargePower],
      costResources: [],
      eventSources: [PowerChargeSource.freeLeech],
      color: "--res-power",
    },
    {
      label: "Paid Leech",
      incomeResources: [Resource.ChargePower],
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
      eventSources: [PowerChargeSource.terrans],
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
      label: "Trade",
      costResources: [],
      incomeResources: balanceSheetResources,
      eventSources: [tradeSource, tradeCostSource],
      color: colorCodes.tradeShip.color,
    },
    {
      label: "Waste",
      description: "Also includes tye use of tokens in area2 or area3 for gaia forming or forming federations",
      costResources: balanceSheetResources,
      incomeResources: [],
      eventSources: [waste],
      color: "--res-qic",
    },
  ];
}

function isPayPower(wantResource: Resource, reward: Reward) {
  return wantResource == Resource.ChargePower && reward.type == Resource.ChargePower && reward.count < 0;
}

function effectiveAmount(reward: Reward | null, wantResource: Resource, faction: Faction): number {
  if (reward == null) {
    return 0;
  }

  if (wantResource == Resource.GainToken) {
    if (reward.type == Resource.BurnToken && faction != Faction.Itars) {
      return -reward.count;
    }
    if (reward.type == Resource.Brainstone) {
      return reward.count;
    }
  }
  return reward.type == wantResource ? reward.count : 0;
}

function resourceChanges<Source>(
  changes: ResourceSimulatorChanges,
  source: Source,
  wantResource: Resource,
  faction: Faction,
  eventSources: BalanceSheetSourceType[],
  matchesEventSource: (s: Source, e: EventSource, reward: Reward, amount: number) => number
): number {
  return sum(
    Object.entries(changes).flatMap((c) => {
      const eventSource = c[0] as EventSource;
      return c[1].map((reward) => {
        const amount = effectiveAmount(reward, wantResource, faction);
        const abs = Math.abs(amount);
        if (abs == 0) {
          return 0;
        }

        if (eventSource == Command.ChargePower && wantResource == Resource.ChargePower) {
          if (eventSources.includes(PowerChargeSource.freeLeech)) {
            return 1;
          } else if (eventSources.includes(PowerChargeSource.paidLeech)) {
            return amount - 1;
          }
          return 0;
        }

        return matchesEventSource(source, eventSource, reward, amount);
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

function currentAmount(data: PlayerData, wantResource: Resource) {
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

export function balanceSheetExtractLog<Source>(
  getWantResource: (s: Source) => Resource,
  getSources: (s: Source) => BalanceSheetSourceType[],
  matchesEventSource: (s: Source, e: EventSource, reward: Reward, amount: number) => number
): ExtractLog<any> {
  return resourceCounter((want, a, data, simulateResources) => {
    const wantResource = getWantResource(a.source);
    let old = currentAmount(data, wantResource);
    const oldPower3 = data.power.area3;
    const oldBrainstone = data.brainstone;
    const changes = simulateResources();

    const eventSources = getSources(a.source);
    if (eventSources.includes(PowerChargeSource.terrans) && a.log.phase == Phase.RoundGaia) {
      return data.power.gaia;
    }

    if (a.log.player != want.player) {
      return 0;
    }

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

    const faction = want.faction;
    const isTerranCharge = faction == Faction.Terrans && a.cmd != null && isGaiaMove([a.cmd]);
    if (eventSources.includes(waste) && !isTerranCharge) {
      const diff = currentAmount(data, wantResource) - old;
      const gain =
        sum(
          Object.values(changes)
            .flat()
            .map((r) => effectiveAmount(r, wantResource, faction))
        ) * (payPower ? 2 : 1);

      const waste = gain - diff;
      if (waste < 0) {
        throw Error(
          `negative waste in ${JSON.stringify(a.log)}: cmd=${JSON.stringify(
            a.cmd
          )} resource=${wantResource} gain=${gain} diff=${diff}`
        );
      }
      return waste;
    }
    return resourceChanges(changes, a.source, wantResource, faction, eventSources, matchesEventSource);
  });
}

export function balanceSheetSourceFactory(
  wantResource: Resource,
  expansion: Expansion
): SimpleSourceFactory<ChartSource<string>> {
  const income = new Map<BalanceSheetSourceType, string>();
  const cost = new Map<BalanceSheetSourceType, string>();

  return {
    name: wantResource == Resource.GainToken ? "Power Tokens" : resourceData[wantResource].plural,
    group: ChartGroup.resources,
    playerSummaryLineChartTitle: `Income and Expenses of ${resourceData[wantResource].plural} of all players`,
    summary: ChartSummary.balance,
    extractLog: balanceSheetExtractLog<BalanceSheetSource>(
      () => wantResource,
      (s) => s.eventSources,
      (source, eventSource, reward, amount) => {
        const label = amount < 0 ? cost.get(eventSource) : income.get(eventSource);

        if (label == null) {
          throw Error(`no source found for eventSource=${eventSource} reward=${reward}`);
        }
        return source.label === label ? Math.abs(amount) : 0;
      }
    ),
    sources: balanceSheetSources(expansion)
      .filter((s) => s.incomeResources.includes(wantResource))
      .map((s) => newBalanceSource(s, "income", 1, income))
      .concat(
        balanceSheetSources(expansion)
          .filter((s) => s.costResources.includes(wantResource))
          .map((s) => newBalanceSource(s, "cost", -1 * (s.costFactor ?? 1), cost))
      ),
  };
}
