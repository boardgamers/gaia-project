import { Booster, Command, EventSource, ResearchField, Resource, TechPos } from "@gaia-project/engine";
import assert from "assert";
import { extractChanges, statelessExtractLog } from "../charts";
import { SimpleSource, SimpleSourceFactory } from "../simple-charts";

enum PowerChargeSource {
  burn,
  freeLeech,
  paidLeech,
  income,
  tech,
  booster,
  research,
}

const powerChargeSources: SimpleSource<PowerChargeSource>[] = [
  {
    type: PowerChargeSource.burn,
    label: "Burn",
    color: "--dig",
    weight: 1,
  },
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
];

const powerChargeSourceMap = new Map<EventSource, PowerChargeSource>([
  [Command.ChooseIncome, PowerChargeSource.income],
  ...new Map(TechPos.values().map((p) => [p, PowerChargeSource.tech])),
  ...new Map(Booster.values().map((b) => [b, PowerChargeSource.booster])),
  ...new Map(ResearchField.values().map((f) => [f, PowerChargeSource.research])),
]);

const extractPowerCharge = (eventSource: EventSource, source: PowerChargeSource, charge: number): number => {
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
  assert(false, "no source found: " + eventSource);
};

export const powerCharges: SimpleSourceFactory<SimpleSource<PowerChargeSource>> = {
  name: "Power Charges",
  playerSummaryLineChartTitle: "Power Charges of all players",
  showWeightedTotal: false,
  // extractLog: statelessExtractLog(extractPowerCharge),
  extractChange: (wantPlayer, source) =>
    extractChanges(wantPlayer.player, (player, eventSource, resource, round, change) =>
      resource == Resource.ChargePower && change > 0 ? extractPowerCharge(eventSource, source.type, change) : 0
    ),
  extractLog: statelessExtractLog((e) =>
    e.source.type == PowerChargeSource.burn && e.cmd.command == Command.BurnPower ? Number(e.cmd.args[0]) : 0
  ),
  sources: powerChargeSources,
};
