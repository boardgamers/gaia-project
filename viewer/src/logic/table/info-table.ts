import Engine, { Player } from "@gaia-project/engine";
import { UiMode } from "../../store";
import { generalTables, playerCell } from "./general";
import { playerTables } from "./player";
import {
  Cell,
  ConversionSupport,
  defaultBackground,
  emptyCell,
  InfoTable,
  InfoTableColumn,
  InfoTableFlex,
  InfoTableRow,
  PlayerTable,
  uiModeSettings,
} from "./types";
import { deactivatedLabel, formatCell } from "./util";

function field(c: Cell, sortable: boolean): InfoTableColumn {
  return {
    key: c.title,
    label: deactivatedLabel(c),
    sortable,
    cells: formatCell([c]),
  };
}

export function playerTableRow(t: PlayerTable, p: Player, passed: boolean): InfoTableRow {
  const row: InfoTableRow = {};
  for (const column of t.columns) {
    const cell = column.cell(p, passed);
    row[column.title] = formatCell(
      typeof cell == "object"
        ? ((cell.length == 0 ? [emptyCell] : cell) as Cell[])
        : [
            {
              shortcut: String(cell),
              title: column.title,
              color: column.color,
            },
          ],
      column.flex ?? InfoTableFlex.rowGrow
    );
  }
  return row;
}

export function infoTables(
  engine: Engine,
  orderedPlayers: Player[],
  uiMode: UiMode,
  support: ConversionSupport
): InfoTable[] {
  const settings = uiModeSettings[uiMode];

  function caption(s: string): string | null {
    return settings.caption ? s : null;
  }

  function createRows(createRow: (p: Player, passed: boolean) => InfoTableRow): InfoTableRow[] {
    return orderedPlayers.map((p) => {
      const passed = (engine.passedPlayers || []).includes(p.player);
      const row = createRow(p, passed);
      row.order = formatCell([playerCell(p, true)]);
      return row;
    });
  }

  const gTables: InfoTable[] = generalTables(engine).map((t) => {
    const row: InfoTableRow = {};
    for (const column of t.columns) {
      row[column.header.title] = formatCell([column.row]);
    }
    return {
      caption: caption(t.caption),
      fields: t.columns.map((c) => field(c.header, false)),
      rows: [row],
    };
  });
  gTables[gTables.length - 1].break = true;

  const pTables: InfoTable[] = playerTables(engine, support, uiMode == UiMode.compactTable).map((t) => ({
    caption: caption(t.caption),
    fields: t.columns.map((c) => field(c, settings.sortable)),
    additionalHeader: t.columns
      .filter((c) => c.additionalHeader)
      .map((c) => ({
        cells: formatCell(c.additionalHeader.cells, c.additionalHeader.flex),
        colspan: 1,
      })),
    rows: createRows((p, passed) => playerTableRow(t, p, passed)),
  }));
  pTables.forEach((r, i) => {
    const extraColumns: number = settings.rowHeaderOnAllColumns || i == 0 ? 1 : 0;
    if (extraColumns) {
      r.fields.unshift({
        key: "order",
        sortable: settings.sortable,
        cells: formatCell([
          {
            shortcut: "",
            title: "Faction in play order",
            color: defaultBackground,
          },
        ]),
      });
    }
  });
  return gTables.concat(...pTables);
}
