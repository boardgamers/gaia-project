import {
  Booster,
  Building,
  Command,
  EventSource,
  Faction,
  GaiaHex,
  MaxLeech,
  Phase,
  ResearchField,
  Resource,
  Reward,
  TechPos,
  TechTile,
} from "@gaia-project/engine";
import { ChartSource, extractChanges } from "./charts";
import { parsePowerUsage, resourceCounter } from "./resource-counter";
import { ExtractChange, ExtractLog, ExtractLogArg, ExtractLogEntry, SimpleSourceFactory } from "./simple-charts";

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
    color: "--rt-sci",
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

function isSpecialOperator(a: ExtractLogArg<any>) {
  return a.data.tiles.techs[a.cmd.args[0]].tile == TechTile.Tech3;
}

export function leechOpportunities(wantSource: (maxLeech: MaxLeech) => number): ExtractLog<ChartSource<LeechSource>> {
  let hasPlanetaryInstitute = false;
  let hasSpecialOperator = false;
  const buildings: Map<GaiaHex, Building> = new Map<GaiaHex, Building>();
  return resourceCounter((want, a, data, simulateResources) => {
    simulateResources();

    if (a.cmd?.command == Command.Build) {
      const building = a.cmd.args[0] as Building;
      const location = a.cmd.args[1];
      const map = a.data.map;
      const { q, r } = map.parse(location);
      const hex = map.grid.get({ q, r });

      if (building == Building.PlanetaryInstitute) {
        hasPlanetaryInstitute = true;
      }

      if (a.log.player == want.player) {
        buildings.set(hex, building);
      } else {
        //check for missed leech
        const leechPossible = a.data.leechPossible(hex, (h) =>
          want.buildingValue(map.grid.get(h), {
            building: buildings.get(h),
            hasPlanetaryInstitute,
            hasSpecialOperator,
          })
        );
        const maxLeech = data.maxLeech(leechPossible, want.faction == Faction.Taklons && hasPlanetaryInstitute);
        return Math.max(0, leechPossible - wantSource(maxLeech));
      }
    }

    if (a.log.player == want.player) {
      if (a.cmd?.command == Command.ChooseTechTile && isSpecialOperator(a)) {
        hasSpecialOperator = true;
      }
      if (a.cmd?.command == Command.ChooseCoverTechTile && isSpecialOperator(a)) {
        hasSpecialOperator = false;
      }
    }

    return 0;
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
  extractLog: ExtractLog.wrapper((p, s) => {
    switch (s.type) {
      case LeechSource.MissedVp:
        return leechOpportunities((maxLeech) => maxLeech.victoryPoints);
      case LeechSource.MissedCharge:
        return leechOpportunities((maxLeech) => maxLeech.charge);
      case LeechSource.Declined:
        return ExtractLog.stateless((a) =>
          a.cmd?.command == Command.Decline
            ? Reward.parse(a.cmd.args[0]).find((r) => r.type == Resource.ChargePower).count
            : 0
        );
    }
    return ExtractLog.noop();
  }),
  sources: leechSources,
};
