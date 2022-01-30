import {
  Building,
  Expansion,
  Faction,
  factionBoard,
  lastTile,
  PlayerData,
  researchEvents,
  ResearchField,
  Resource,
} from "@gaia-project/engine";
import { tradeCost, TradeOption, tradeOptions, tradeRewards } from "@gaia-project/engine/src/available/ships";
import { buildingData } from "../data/building";
import { ResourceText, ResourceTextSymbols } from "../graphics/utils";
import { cellStyle } from "./info-table";

type TradeRow = { style: string; cells: ResourceText[] };

const levels = Array.from(Array(lastTile(ResearchField.Diplomacy) + 1).keys());

export function tradeHeaders(): string[] {
  return ["Name"].concat(levels.map((level) => `Diplomacy ${level}`));
}

function row(option: TradeOption): TradeRow {
  const b = option.building;
  const data = buildingData[b];
  const name: ResourceText = [
    `${option.domestic ? "Domestic" : "Foreign"} ${b === Building.Academy1 ? "Academy" : data.name}`,
  ];

  const cells: ResourceText[] = levels.map((level) => {
    const guest = new PlayerData();

    [...Array(level + 1).keys()]
      .map((l) => researchEvents(ResearchField.Diplomacy, l, Expansion.Frontiers))
      .forEach((events, l) => {
        for (const e of events) {
          guest.gainRewards(e.rewards);
        }
      });

    const cost = tradeCost(guest, option);
    cost.type = Resource.PayPower;
    const rewards = tradeRewards(option, guest, guest);
    const bld = option.build;
    const buildDesc = bld
      ? `<br/>Build ${buildingData[bld].name} for ${factionBoard(Faction.Terrans).buildings[bld].cost.join(",")}`
      : "";
    const academy = option.researchAdvancementBonus ? ` *` : "";
    return [[cost], ResourceTextSymbols.arrow, rewards, `${buildDesc}${academy}`];
  });

  return {
    style: cellStyle(data.color),
    cells: [name].concat(cells),
  };
}

export function tradeRows(): TradeRow[] {
  return tradeOptions.map((option) => row(option));
}
