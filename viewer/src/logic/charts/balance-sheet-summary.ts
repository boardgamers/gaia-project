import {ChartGroup, ChartSource} from "./charts";
import {balanceSheetEventSources, balanceSheetExtractLog, BalanceSheetSourceTemplate, BalanceSheetSourceType} from "./balance-sheet";
import {ChartSummary, SimpleSourceFactory} from "./simple-charts";
import {Expansion, Resource} from "@gaia-project/engine";
import {resourceSources} from "./resources";

class BalanceSheetResourceSource extends ChartSource<string> {
  // eventSources: BalanceSheetSourceType[];
}

function balanceSheetSummary(
  name: string,
  description: string,
  sources: ChartSource<any>[],
  summary: ChartSummary,
  wantEventSources: BalanceSheetSourceType[],
  amountFilter: (v: number) => boolean
): SimpleSourceFactory<ChartSource<any>> {
  return {
    name,
    group: ChartGroup.resources,
    playerSummaryLineChartTitle: description,
    summary,
    extractLog: balanceSheetExtractLog<ChartSource<Resource>>(
      (s) => s.type,
      () => wantEventSources,
      (s, e, reward, amount) => (amountFilter(amount) && wantEventSources.includes(e) ? amount : 0)
    ),
    sources,
  };
}

function newResourceBalanceSource(
  r: Resource,
  name: string,
  weight: number,
): BalanceSheetResourceSource {
  const s = resourceSources.find(s => s.type === r);
  const label = `${s.label} ${name}`;
  return {
    type: label,
    label,
    description: s.description || label,
    weight,
    color: s.color,
  };
}

export function resourceSourceFactory(expansion: Expansion): SimpleSourceFactory<ChartSource<Resource>> {
  return balanceSheetSummary(
    "Overview",
    "Resources of all players as if bought with power",
    resourceSources,
    ChartSummary.weightedTotal,
    balanceSheetEventSources(expansion)
      .filter((s) => s.incomeResources.length > 0)
      .flatMap((s) => s.eventSources),
    (a) => a > 0
  );
}

export function balanceSheetEventSourceFactory(source: BalanceSheetSourceTemplate, expansion: Expansion): SimpleSourceFactory<ChartSource<Resource>> {
  const sources = source.incomeResources
    .map((s) => newResourceBalanceSource(s, "income", 1))
    .concat(
      source.costResources
        .map((s) => newResourceBalanceSource(s, "cost", -1 * (source.costFactor ?? 1)))
    );

  return balanceSheetSummary(
    source.label,
    `Resources from ${source.label} of all players as if bought with power`,
    sources,
    ChartSummary.balance,
    source.eventSources,
    () => true
  );
}


