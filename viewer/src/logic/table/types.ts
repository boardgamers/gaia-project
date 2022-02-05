import { Player, PlayerEnum, PowerArea, Resource as ResourceEnum } from "@gaia-project/engine";
import { richText, RichText } from "../../graphics/utils";
import { BvTableField } from "bootstrap-vue/src/components/table";
import { CellStyle, playerColor, staticCellStyle } from "../../graphics/colors";
import { UiMode } from "../../store";
import { factionName } from "../../data/factions";

export type Convert = ResourceEnum | PowerArea;

export enum InfoTableFlex {
  row = "row",
  rowGrow = "rowGrow",
  column = "column",
}

export type InfoTableCell = {
  label: RichText;
  title: string | null;
  style: string;
  convert?: Convert;
  flex: InfoTableFlex;
};

export type InfoTableRow = {
  [key in string]: InfoTableCell[];
};

export type InfoTableAdditionalHeader = { cells: InfoTableCell[]; colspan: number };

export type InfoTableColumn = BvTableField & { key: string; cells: InfoTableCell[] };

export type InfoTable = {
  caption: string;
  fields: InfoTableColumn[];
  rows: InfoTableRow[];
  additionalHeader?: InfoTableAdditionalHeader[];
  break?: boolean;
};

export type ConversionSupport = {
  convertTooltip(resource: Convert, player: PlayerEnum): string | null;
};

export type Cell = {
  shortcut: string | RichText;
  title: string;
  color: string | CellStyle;
  deactivated?: boolean;
  convert?: Convert;
};

export const defaultBackground = "white";

export const emptyCell: Cell = {
  shortcut: "",
  title: "",
  color: defaultBackground,
};

export type CellContent = string | number | Cell[];

export type PlayerColumn = Cell & {
  cell: (p: Player, passed: boolean) => CellContent;
  additionalHeader?: { cells: Cell[]; flex?: InfoTableFlex };
  flex?: InfoTableFlex;
};

export type PlayerTable = {
  caption: string;
  columns: PlayerColumn[];
};

export type GeneralTable = {
  caption: string;
  columns: { header: Cell; row: Cell }[];
};

export type TableSettings = {
  sortable: boolean;
  rowHeaderOnAllColumns: boolean;
  caption: boolean;
};

export const uiModeSettings: { [key in UiMode]?: TableSettings } = {
  [UiMode.table]: {
    sortable: false,
    rowHeaderOnAllColumns: false,
    caption: true,
  },
  [UiMode.compactTable]: {
    sortable: false,
    rowHeaderOnAllColumns: false,
    caption: false,
  },
};

export const stripUnderline = new RegExp("<u>(.*?)</u>", "g");

