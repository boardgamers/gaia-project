import { ChartConfiguration } from "chart.js";
import { TableMeta } from "./chart-factory";
import { ChartStyleDisplay, ColorVar } from "./charts";

const nameColumn = {
  key: "Name",
  isRowHeader: true,
  sortable: true,
};

const weightKey = "Weight";

type CellStyle = { color: string; backgroundColor: string };

export function cellStyle(canvas: HTMLElement, backgroundColor: ColorVar): CellStyle {
  return {
    backgroundColor: backgroundColor.lookup(canvas),
    color: new ColorVar(backgroundColor.color + "-text").lookup(canvas) ?? "black",
  };
}

export function tableHeader(
  canvas: HTMLCanvasElement,
  style: ChartStyleDisplay,
  config: ChartConfiguration<any>,
  tableMeta?: TableMeta
): any[] {
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
    ...config.data.datasets.map((s) => ({
      thStyle: cellStyle(canvas, new ColorVar(s.backgroundColor)),
      key: s.label,
      sortable: true,
      label: cropLabel(meta?.[s.label]?.label ?? s.label),
    }))
  );
  return headers;
}

export function rowHeaderCell(s: CellStyle, label: string) {
  return `<span style="background-color: ${s.backgroundColor}; color: ${s.color}">${label}</span>`;
}

function dataCell(label: any) {
  return `<span>${label}</span>`;
}

function totalsCell(label: any) {
  return `<span class="totals">${label}</span>`;
}

export function tableItems(canvas: HTMLCanvasElement, config: ChartConfiguration<any>, tableMeta?: TableMeta): any[] {
  const datasets = config.data.datasets;
  const totals = {};
  const weightedTotals = {};
  const rows = (datasets[0].data as number[]).map(() => ({}));
  const colors = tableMeta?.colors;
  config.data.labels.forEach(
    (s, index) =>
      (rows[index][nameColumn.key] =
        colors == null ? dataCell(s) : rowHeaderCell(cellStyle(canvas, colors[index]), s as string))
  );
  const weights = tableMeta?.weights;
  if (weights != null) {
    weights.forEach((s, index) => {
      rows[index][weightKey] = dataCell(s);
    });
  }
  totals[nameColumn.key] = dataCell("Total");
  weightedTotals[nameColumn.key] = dataCell("Weighted Total");

  function cell(value: any): any {
    const val = typeof value == "number" ? value : value.y;
    if (isNaN(val)) {
      return "";
    }
    return val;
  }

  for (const s of datasets) {
    (s.data as number[]).forEach((value, index) => {
      rows[index][s.label] = dataCell(cell(value));
    });
    const meta = tableMeta?.datasetMeta?.[s.label];
    if (meta?.total != null) {
      totals[s.label] = totalsCell(meta.total);
    }
    if (meta?.weightedTotal != null) {
      weightedTotals[s.label] = totalsCell(meta.weightedTotal);
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
