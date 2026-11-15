import type Engine from "@gaia-project/engine";
import type { ChartSetup } from "./chart-factory";

export function createTestChartConfig(setup: ChartSetup, chartSelect: string, chartType: string, engine: Engine) {
  const config = setup.newBarChart(
    {
      type: "table",
      label: "Table",
      compact: false,
    },
    setup.factory(chartSelect, chartType),
    engine,
    (c) => c
  );
  delete config.table.descriptions;
  return config;
}
