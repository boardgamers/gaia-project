import { Command, Faction, leechPossible, MaxLeech, Phase, Resource, Reward } from "@gaia-project/engine";
import { ChartSource, extractChanges } from "./charts";
import { BuildingPowerValueCounter } from "./federations";
import { resourceCounter } from "./resource-counter";
import type { ExtractChange, ExtractLogEntry, SimpleSourceFactory } from "./simple-charts";
import { ChartSummary, ExtractLog } from "./simple-charts";

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

const leechSources: ChartSource<LeechSource>[] = [
  {
    type: LeechSource.leech1,
    label: "Charge 1 (free)",
    color: "--rt-terra",
    weight: 1,
  },
  {
    type: LeechSource.leech2,
    label: "Charge 2 (1 VP)",
    color: "--rt-nav",
    weight: 1,
  },
  {
    type: LeechSource.leech3,
    label: "Charge 3 (2 VP)",
    color: "--rt-int",
    weight: 1,
  },
  {
    type: LeechSource.leech4,
    label: "Charge 4 (3 VP)",
    color: "--rt-gaia",
    weight: 1,
  },
  {
    type: LeechSource.leech5,
    label: "Charge 5 (4 VP)",
    color: "--rt-eco",
    weight: 1,
  },
  {
    type: LeechSource.Declined,
    label: "Declined Charge",
    color: "--lost",
    weight: 0,
  },
  {
    type: LeechSource.MissedVp,
    label: "Missed Charge (lack of VP)",
    color: "--rt-sci",
    weight: 0,
  },
  {
    type: LeechSource.MissedCharge,
    label: "Missed Charge (lack of tokens)",
    color: "--tech-tile",
    weight: 0,
  },
];

function extractLeech(eventSource, source, charge) {
  return eventSource == Command.ChargePower ? (leechSources[charge - 1].type == source ? charge : 0) : 0;
}

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
          const possible = leechPossible(a.data, map.getS(a.cmd.args[1]), (h) => counter.buildingValue(h, map, want));
          const maxLeech = data.maxLeech(possible, want.faction == Faction.Taklons && counter.hasPlanetaryInstitute);

          return Math.max(0, possible - wantSource(maxLeech));
        }
      }

      return 0;
    });
  });
}

function powerChargeDetails(): ExtractChange<any> {
  return (wantPlayer, source) =>
    extractChanges(wantPlayer.player, (player, eventSource, resource, round, change, logIndex) => {
      return resource == Resource.ChargePower && change > 0 ? extractLeech(eventSource, source.type, change) : 0;
    });
}

export const terranChargeExtractLog: (sourceType: any) => ExtractLogEntry<any> = (sourceType: any) => ({
  factionFilter: [Faction.Terrans],
  sourceTypeFilter: [sourceType],
  extractLog: resourceCounter((want, a, data, simulateResources) => {
    simulateResources();

    return a.log.phase == Phase.RoundGaia ? data.power.gaia : 0;
  }),
});

export const leechSourceFactory: SimpleSourceFactory<ChartSource<LeechSource>> = {
  name: "Power Charge",
  playerSummaryLineChartTitle: "Power Charge of all players",
  summary: ChartSummary.weightedTotal,
  extractChange: powerChargeDetails(),
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
          ? (Reward.parse(a.cmd.args[0]).find((r) => r.type == Resource.ChargePower)?.count ?? 0)
          : 0
      ),
    },
  ]),
  sources: leechSources,
};
