import { Player, PowerArea, Resource, Reward } from "@gaia-project/engine";
import { Cell, ConversionSupport, PlayerColumn, stripUnderline } from "./types";
import { resourceData } from "../../data/resources";
import { colorCodes } from "../color-codes";
import { lightenDarkenColor } from "../../graphics/utils";
import { skipZero } from "./util";
import { plusReward } from "../utils";

export function resourceCell(r: Resource | PowerArea): Cell {
  const d = resourceData[r];
  if (d) {
    return {
      shortcut: d.shortcut,
      title: d.plural,
      color: d.color,
    };
  }
  if (r == PowerArea.Gaia) {
    return colorCodes.gaia.add({
      title: "Power area gaia",
    });
  }
  const area = r.substring(r.length - 1);
  return {
    shortcut: area,
    title: `Power area ${area}`,
    color: {
      color: "white",
      backgroundColor: lightenDarkenColor("#984ff1", Number(area) * -40),
    },
  };
}

function brainstone() {
  const r = new Reward(1, Resource.Qic);
  r.type = "brainstone" as Resource; //it's not a real resource
  return r;
}

function powerRichText(r: Resource | PowerArea, hasIncome: boolean, val: string | number, income: number) {
  function resource(): Resource {
    switch (r) {
      case PowerArea.Area1:
      case PowerArea.Area2:
      case PowerArea.Area3:
        return Resource.BowlToken;
      case PowerArea.Gaia:
        return Resource.GainTokenGaiaArea;
    }
    return r as Resource;
  }

  function reward(value: string | number): Reward[] {
    const split = String(value)
      .split(",")
      .map((s) => s.trim());
    if (split.length > 1) {
      const base = reward(split[0]);
      const extra = split[1];
      return (base[0].count == 0 ? [] : base).concat(extra === "B" ? [brainstone()] : Reward.parse(extra));
    }
    return [new Reward(Number(value), resource())];
  }

  if (hasIncome) {
    return [{ rewards: reward(val).concat(plusReward).concat(reward(income)) }];
  }
  return String(val) === "0" ? [] : [{ rewards: reward(val) }];
}

export function incomeCell(
  r: Resource | PowerArea,
  val: string | number,
  income: number,
  player: Player,
  support: ConversionSupport | null,
  compact: boolean,
  incomeType: string = null
): Cell[] {
  const cell = resourceCell(r);
  const tooltip = support?.convertTooltip(r, player.player)?.replace(stripUnderline, (match, group) => group);
  const hasIncome = income > 0;
  if (incomeType && hasIncome) {
    cell.title = `${cell.title} (+${incomeType} income)`;
  }
  if (tooltip) {
    cell.title = `${cell.title} (${tooltip})`;
  }
  const shortcut = compact
    ? hasIncome
      ? `${val}+${income}`
      : skipZero(val)
    : powerRichText(r, hasIncome, val, income);

  return [
    {
      shortcut,
      title: cell.title,
      color: cell.color,
      convert: tooltip ? r : null,
    },
  ];
}

export function realIncomeCell(
  resource: Resource | PowerArea,
  current: string | number,
  p: Player,
  incomeResource: Resource,
  support: ConversionSupport,
  showIncome: (Player) => boolean,
  compact: boolean,
  incomeType: string
) {
  return incomeCell(
    resource,
    current,
    showIncome(p) ? p.resourceIncome(incomeResource) : 0,
    p,
    support,
    compact,
    incomeType
  );
}

export function resourceColumn(
  r: Resource,
  showIncome: (Player) => boolean,
  compact: boolean,
  support?: ConversionSupport | null
): PlayerColumn {
  const cell = resourceCell(r);
  return {
    shortcut: cell.shortcut,
    title: cell.title,
    color: cell.color,
    cell: (p) => realIncomeCell(r, p.data.getResources(r), p, r, support, showIncome, compact, null),
  };
}
