import { Expansion, Resource } from "@gaia-project/engine";
import {
  balanceSheetEventSources,
  balanceSheetExtractLog,
  balanceSheetResourceName,
  BalanceSheetSourceTemplate,
} from "./balance-sheet";
import { ChartGroup, ChartSource } from "./charts";
import { resourceSources } from "./resources";
import { ChartSummary, SimpleSourceFactory } from "./simple-charts";

class BalanceSheetResourceSource extends ChartSource<string> {
  resource: Resource;
}

function newResourceBalanceSource(
  r: Resource,
  name: string,
  weight: number,
  lookup: Map<Resource, string>
): BalanceSheetResourceSource {
  const s = resourceSources.find((s) => s.type === r);
  const label = `${balanceSheetResourceName(r)} ${name}`;
  lookup.set(r, label);
  return {
    type: label,
    label,
    description: s.description || label,
    weight: s.weight * weight,
    color: s.color,
    resource: r,
  };
}

export function resourceSourceFactory(expansion: Expansion): SimpleSourceFactory<ChartSource<Resource>> {
  const sources = balanceSheetEventSources(expansion)
    .filter((s) => s.incomeResources.length > 0)
    .flatMap((s) => s.eventSources);
  return {
    name: "Overview",
    group: ChartGroup.resources,
    playerSummaryLineChartTitle: "Resources of all players as if bought with power",
    summary: ChartSummary.weightedTotal,
    extractLog: balanceSheetExtractLog<ChartSource<Resource>>(
      (s) => s.type,
      () => sources,
      (s, e, reward) => (reward.count > 0 && sources.includes(e) ? reward.count : 0)
    ),
    sources: resourceSources,
  };
}

export function balanceSheetEventSourceFactory(
  source: BalanceSheetSourceTemplate,
  expansion: Expansion
): SimpleSourceFactory<BalanceSheetResourceSource> {
  const income = new Map<Resource, string>();
  const cost = new Map<Resource, string>();

  const sources = source.incomeResources
    .map((s) => newResourceBalanceSource(s, "income", 1, income))
    .concat(source.costResources.map((s) => newResourceBalanceSource(s, "cost", -1, cost)));

  return {
    name: source.label,
    group: ChartGroup.resources,
    playerSummaryLineChartTitle: `Resources from ${source.label} of all players as if bought with power`,
    summary: ChartSummary.balance,
    extractLog: balanceSheetExtractLog<BalanceSheetResourceSource>(
      (s) => s.resource,
      () => source.eventSources,
      (s, e, reward) => {
        if (!source.eventSources.includes(e)) {
          return 0;
        }
        const label = reward.count < 0 ? cost.get(reward.type) : income.get(reward.type);

        if (label == null) {
          throw Error(`no source found for eventSource=${e} reward=${reward} source=${source.label}`);
        }
        return s.label === label ? Math.abs(reward.count) : 0;
      }
    ),
    sources,
  };
}
