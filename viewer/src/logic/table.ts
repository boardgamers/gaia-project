import {ChartConfiguration} from "chart.js";
import {ChartStyleDisplay, TableMeta} from "./chart-factory";
import {ColorVar} from "./charts";

const nameColumn = {
  key: "Name",
  isRowHeader: true,
  sortable: true,
};

const weightKey = "Weight";

export function tableHeader(canvas: HTMLCanvasElement, style: ChartStyleDisplay, config: ChartConfiguration<any>, tableMeta?: TableMeta): any[] {
  const meta = tableMeta?.datasetMeta;

  const compact = style.compact;

  function cropLabel(label: string): string {
    if (compact) {
      return label.slice(0, 1);
    }
    return label;
  }

  const headers = [nameColumn as any];
  const weights = tableMeta?.weights;
  if (weights != null) {
    headers.push({
      key: weightKey,
      sortable: true,
      label: cropLabel(weightKey),
    });
  }

  headers.push(
    ...config.data.datasets.map((s) => {
      return ({
        thStyle: {
          backgroundColor: new ColorVar(s.backgroundColor).lookup(canvas),
          color: new ColorVar(s.backgroundColor + "-text").lookup(canvas) ?? "black"
        },
        key: s.label,
        sortable: true,
        label: cropLabel(meta?.[s.label]?.label ?? s.label),
      });
    })
  );
  return headers;
}

export function tableItems(style: ChartStyleDisplay, config: ChartConfiguration<any>, tableMeta?: TableMeta): any[] {
  const datasets = config.data.datasets;
  const totals = {};
  const weightedTotals = {};
  const rows = (datasets[0].data as number[]).map(() => ({}));
  config.data.labels.forEach((s, index) => {
    rows[index][nameColumn.key] = s;
  });
  const weights = tableMeta?.weights;
  if (weights != null) {
    weights.forEach((s, index) => {
      rows[index][weightKey] = s;
    });
  }
  totals[nameColumn.key] = "Total";
  weightedTotals[nameColumn.key] = "Weighted Total";

  function cell(value: any) {
    const val = typeof value == "number" ? value : value.y;
    if (isNaN(val)) {
      return "";
    }
    return val;
  }

  for (const s of datasets) {
    (s.data as number[]).forEach((value, index) => {
      rows[index][s.label] = cell(value);
    });
    const meta = tableMeta?.datasetMeta?.[s.label];
    if (meta?.total != null) {
      totals[s.label] = meta.total;
    }
    if (meta?.weightedTotal != null) {
      weightedTotals[s.label] = meta.weightedTotal;
    }
  }
  if (Object.values(totals).length > 1) {
    rows.push(totals);
  }
  if (Object.values(weightedTotals).length > 1) {
    rows.push(weightedTotals);
  }
  return rows;
}
