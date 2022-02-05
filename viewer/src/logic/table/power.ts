import { ConversionSupport, PlayerTable } from "./types";
import { PlayerData, PowerArea, Resource } from "@gaia-project/engine";
import { incomeCell, realIncomeCell, resourceCell } from "./resource";

function powerArea(a: PowerArea, d: PlayerData): string | number {
  return d.brainstone == a ? `${d.power[a]},B` : d.power[a];
}

export function power(showIncome: (Player) => boolean, compact: boolean, support?: ConversionSupport): PlayerTable {
  return {
    caption: "Power",
    columns: Object.values(PowerArea).map((a) => {
      const cell = resourceCell(a);
      return {
        shortcut: cell.shortcut,
        title: cell.title,
        color: cell.color,
        cell: (p) => {
          const power = powerArea(a, p.data);
          switch (a) {
            case PowerArea.Area1:
              return realIncomeCell(a, power, p, Resource.GainToken, support, showIncome, compact, "token");
            case PowerArea.Area2:
              return realIncomeCell(a, power, p, Resource.ChargePower, support, showIncome, compact, "power charge");
            case PowerArea.Area3:
              return incomeCell(a, power, 0, p, support, compact);
            case PowerArea.Gaia:
              return incomeCell(
                a,
                p.data.gaiaformersInGaia ? `${p.data.power.gaia}, ${p.data.gaiaformersInGaia}gf` : p.data.power.gaia,
                0,
                p,
                support,
                compact
              );
          }
        },
      };
    }),
  };
}
