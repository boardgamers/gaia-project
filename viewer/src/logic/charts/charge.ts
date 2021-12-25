import {
  Booster,
  Command,
  EventSource,
  Faction,
  MaxLeech,
  Phase,
  ResearchField,
  Resource,
  Reward,
  TechPos,
} from "@gaia-project/engine";
import { colorCodes } from "../color-codes";
import { ChartSource, extractChanges } from "./charts";
import { BuildingPowerValueCounter } from "./federations";
import { parsePowerUsage, resourceCounter } from "./resource-counter";
import { ExtractChange, ExtractLog, ExtractLogEntry, SimpleSourceFactory } from "./simple-charts";

enum PowerChargeSource {
  freeLeech = "freeLeech",
  paidLeech = "paidLeech",
  income = "income",
  tech = "tech",
  booster = "booster",
  research = "research",
  terrans = "terrans",
  useChargedTokens = "useChargedTokens",
}

enum LeechSource {
  leech1 = "leech1",
  leech2 = "leech2",
  leech3 = "leech3",
  leech4 = "leech4",
  leech5 = "leech5",
  Declined = "declined",
  MissedVp = "missedVp",
  MissedCharge = "missedCharge",
}

const powerChargeSources: ChartSource<PowerChargeSource>[] = [
  {
    type: PowerChargeSource.freeLeech,
    label: "Free Leech",
    color: "--res-power",
    weight: 1,
  },
  {
    type: PowerChargeSource.paidLeech,
    label: "Paid Leech",
    color: "--res-qic",
    weight: 1,
  },
  {
    type: PowerChargeSource.income,
    label: "Income",
    color: "--rt-eco",
    weight: 1,
  },
  {
    type: PowerChargeSource.tech,
    label: "Tech Tile",
    color: "--tech-tile",
    weight: 1,
  },
  {
    type: PowerChargeSource.booster,
    label: "Booster",
    color: "--rt-gaia",
    weight: 1,
  },
  {
    type: PowerChargeSource.research,
    label: "Research",
    color: colorCodes.researchStep.color,
    weight: 1,
  },
  {
    type: PowerChargeSource.terrans,
    label: "Terrans",
    color: "--terra",
    weight: 1,
  },
  {
    type: PowerChargeSource.useChargedTokens,
    label: "Ues Charged Tokens",
    description: "Use tokens in area2 or area3 for gaia forming or forming federations",
    color: "--current-round",
    weight: 1,
  },
];

const leechSources: ChartSource<LeechSource>[] = [
  {
    type: LeechSource.leech1,
    label: "Leech 1 (free)",
    color: "--rt-terra",
    weight: 1,
  },
  {
    type: LeechSource.leech2,
    label: "Leech 2 (1 VP)",
    color: "--rt-nav",
    weight: 1,
  },
  {
    type: LeechSource.leech3,
    label: "Leech 3 (2 VP)",
    color: "--rt-int",
    weight: 1,
  },
  {
    type: LeechSource.leech4,
    label: "Leech 4 (3 VP)",
    color: "--rt-gaia",
    weight: 1,
  },
  {
    type: LeechSource.leech5,
    label: "Leech 5 (4 VP)",
    color: "--rt-eco",
    weight: 1,
  },
  {
    type: LeechSource.Declined,
    label: "Declined Leech",
    color: "--lost",
    weight: 0,
  },
  {
    type: LeechSource.MissedVp,
    label: "Missed Leech (lack of VP)",
    color: "--rt-sci",
    weight: 0,
  },
  {
    type: LeechSource.MissedCharge,
    label: "Missed Leech (lack of tokens)",
    color: "--tech-tile",
    weight: 0,
  },
];

const powerChargeSourceMap = new Map<EventSource, PowerChargeSource>([
  [Command.ChooseIncome, PowerChargeSource.income],
  ...new Map(TechPos.values().map((p) => [p, PowerChargeSource.tech])),
  ...new Map(Booster.values().map((b) => [b, PowerChargeSource.booster])),
  ...new Map(ResearchField.values().map((f) => [f, PowerChargeSource.research])),
]);

type GetPowerChargeDetails<Source> = (
  eventSource: EventSource,
  source: Source,
  charge: number,
  logIndex: number
) => number;

const extractPowerCharge: GetPowerChargeDetails<PowerChargeSource> = (eventSource, source, charge, logIndex) => {
  const s = powerChargeSourceMap.get(eventSource);
  if (s) {
    return s == source ? charge : 0;
  }
  if (eventSource == Command.ChargePower) {
    if (source == PowerChargeSource.freeLeech) {
      return 1;
    } else if (source == PowerChargeSource.paidLeech) {
      return charge - 1;
    }
    return 0;
  }
  console.error("no source found", logIndex, eventSource);
  return 0;
};

const extractLeech: GetPowerChargeDetails<LeechSource> = (eventSource, source, charge) => {
  if (eventSource == Command.ChargePower) {
    const have = leechSources[charge - 1].type;
    if (have == source) {
      return charge;
    }
    return 0;
  }
  return 0;
};

export function leechOpportunities(wantSource: (maxLeech: MaxLeech) => number): ExtractLog<ChartSource<LeechSource>> {
  return ExtractLog.wrapper(() => {
    const counter = new BuildingPowerValueCounter(false);

    return resourceCounter((want, a, data, simulateResources) => {
      simulateResources();

      if (a.log.player == want.player && a.cmd) {
        counter.playerCommand(a.cmd, a.data);
      }

      if (a.cmd?.command == Command.Build) {
        if (a.log.player != want.player) {
          //check for missed leech
          const map = a.data.map;
          const leechPossible = a.data.leechPossible(map.getS(a.cmd.args[1]), (h) =>
            counter.buildingValue(h, map, want)
          );
          const maxLeech = data.maxLeech(
            leechPossible,
            want.faction == Faction.Taklons && counter.hasPlanetaryInstitute
          );

          return Math.max(0, leechPossible - wantSource(maxLeech));
        }
      }

      return 0;
    });
  });
}

function powerChargeDetails(get: GetPowerChargeDetails<PowerChargeSource | LeechSource>): ExtractChange<any> {
  return (wantPlayer, source) =>
    extractChanges(wantPlayer.player, (player, eventSource, resource, round, change, logIndex) =>
      resource == Resource.ChargePower && change > 0 ? get(eventSource, source.type, change, logIndex) : 0
    );
}

export const terranChargeExtractLog: (sourceType: any) => ExtractLogEntry<any> = (sourceType: any) => ({
  factionFilter: [Faction.Terrans],
  sourceTypeFilter: [sourceType],
  extractLog: resourceCounter((want, a, data, simulateResources) => {
    simulateResources();

    return a.log.phase == Phase.RoundGaia ? data.power.gaia : 0;
  }),
});

export const useChargedTokensExtractLog: (sourceType: any) => ExtractLogEntry<any> = (sourceType: any) => ({
  sourceTypeFilter: [sourceType],
  extractLog: resourceCounter((want, a, data, simulateResources) => {
    simulateResources();

    if (a.cmd && want.player == a.log.player) {
      const usage = parsePowerUsage(a.cmd);
      if (usage) {
        return -usage.area2 - 2 * usage.area3;
      }
    }
    return 0;
  }),
});

export const powerChargeSourceFactory: SimpleSourceFactory<ChartSource<PowerChargeSource>> = {
  name: "Power Charges",
  playerSummaryLineChartTitle: "Power Charges of all players",
  showWeightedTotal: false,
  extractChange: powerChargeDetails(extractPowerCharge),
  extractLog: ExtractLog.mux([
    terranChargeExtractLog(PowerChargeSource.terrans),
    useChargedTokensExtractLog(PowerChargeSource.useChargedTokens),
  ]),
  sources: powerChargeSources,
};

export const leechSourceFactory: SimpleSourceFactory<ChartSource<LeechSource>> = {
  name: "Power Leech",
  playerSummaryLineChartTitle: "Power Leech of all players",
  showWeightedTotal: true,
  extractChange: powerChargeDetails(extractLeech),
  extractLog: ExtractLog.mux([
    {
      sourceTypeFilter: [LeechSource.MissedVp],
      extractLog: leechOpportunities((maxLeech) => maxLeech.victoryPoints),
    },
    {
      sourceTypeFilter: [LeechSource.MissedCharge],
      extractLog: leechOpportunities((maxLeech) => maxLeech.charge),
    },
    {
      sourceTypeFilter: [LeechSource.Declined],
      extractLog: ExtractLog.filterPlayer((a) =>
        a.cmd?.command == Command.Decline && a.cmd.args[0]
          ? Reward.parse(a.cmd.args[0]).find((r) => r.type == Resource.ChargePower)?.count ?? 0
          : 0
      ),
    },
  ]),
  sources: leechSources,
};
