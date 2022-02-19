import { ChartConfiguration } from "chart.js";
import { CellStyle, staticCellStyle } from "../../graphics/colors";
import { DatasetSummary, TableMeta } from "./chart-factory";
import { ChartStyleDisplay } from "./charts";

const nameColumn = {
  key: "Name",
  isRowHeader: true,
  sortable: true,
};

const weightKey = "Weight";

export function tableHeader(style: ChartStyleDisplay, config: ChartConfiguration<any>, tableMeta?: TableMeta): any[] {
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
      thStyle: staticCellStyle(s.backgroundColor),
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

const tableTotals: { name: string; get: (s: DatasetSummary) => number | null }[] = [
  {
    name: "Total",
    get: (s) => s.total,
  },
  {
    name: "Weighted Total",
    get: (s) => s.weightedTotal,
  },
  {
    name: "Income",
    get: (s) => s.income,
  },
  {
    name: "Cost",
    get: (s) => s.cost,
  },
  {
    name: "Balance",
    get: (s) => s.balance,
  },
];

export function tableItems(config: ChartConfiguration<any>, tableMeta?: TableMeta): any[] {
  const datasets = config.data.datasets;
  const totals = tableTotals.map((t) => ({ [nameColumn.key]: dataCell(t.name) }));
  const rows = (datasets[0].data as number[]).map(() => ({}));
  const colors = tableMeta?.colors;
  config.data.labels.forEach(
    (s, index) =>
      (rows[index][nameColumn.key] =
        colors == null ? dataCell(s) : rowHeaderCell(staticCellStyle(colors[index]), s as string))
  );
  const weights = tableMeta?.weights;
  if (weights != null) {
    weights.forEach((s, index) => {
      rows[index][weightKey] = dataCell(s);
    });
  }

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
    if (meta != null) {
      for (let i = 0; i < tableTotals.length; i++) {
        const tableTotal = tableTotals[i];
        const val = tableTotal.get(meta);
        if (val != null) {
          totals[i][s.label] = totalsCell(val);
        }
      }
    }
  }
  for (const total of totals) {
    if (Object.values(total).length > 1) {
      rows.push(total);
    }
  }
  return rows;
}
