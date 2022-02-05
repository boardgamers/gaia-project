import { CellStyle, staticCellStyle } from "../../graphics/colors";
import { richText } from "../../graphics/rich-text";
import { Cell, InfoTableCell, InfoTableFlex } from "./types";

export function deactivated(s: string, deactivated = true): string {
  return deactivated ? `<s><i>${s}</i></s>` : s;
}

export function resolveCellColor(color: string | CellStyle): CellStyle {
  if (typeof color === "object") {
    return color;
  } else if (color.startsWith("--")) {
    return staticCellStyle(color);
  } else {
    return {
      backgroundColor: color,
      color: "black",
    };
  }
}

export function cellStyle(color: string | CellStyle): string {
  const cellColor = color ? resolveCellColor(color) : null;
  return cellColor ? `background: ${cellColor.backgroundColor}; color: ${cellColor.color};` : "";
}

export function deactivatedLabel(c: Cell): string {
  return deactivated(c.shortcut?.toString()?.toUpperCase(), c.deactivated ?? false);
}

export function formatCell(cells: Cell[], flex = InfoTableFlex.rowGrow): InfoTableCell[] {
  return cells.map((c) => {
    const style = cellStyle(c?.color);
    return {
      label: typeof c.shortcut === "string" ? [richText(deactivatedLabel(c))] : c.shortcut,
      style,
      convert: c.convert,
      title: c.title,
      flex,
    };
  });
}

export function skipZero(val: string | number): string {
  return String(val) !== "0" ? String(val) : "";
}
