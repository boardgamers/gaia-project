import Engine, {
  Building,
  Expansion,
  Faction,
  factionBoard,
  lastTile,
  PlayerData,
  researchEvents,
  ResearchField,
} from "@gaia-project/engine";
import { tradeCost, TradeOption, tradeOptions, tradeRewards } from "@gaia-project/engine/src/available/ships";
import { buildingData } from "../data/building";
import { staticCellStyle } from "../graphics/colors";
import { rowHeaderCell } from "./charts/table";

const levels = Array.from(Array(lastTile(ResearchField.Diplomacy) + 1).keys());

export function tradeRewardFields(engine: Engine): any[] {
  return [{ key: "Name", sortable: true, isRowHeader: true } as { key: string }].concat(
    levels.map((level) => {
      return {
        key: String(level),
        label: `Diplomacy ${level}`,
        sortable: true,
      };
    })
  );
}

function row(option: TradeOption) {
  const b = option.building;
  const data = buildingData[b];
  const name = `${option.domestic ? "Domestic" : "Foreign"} ${b === Building.Academy1 ? "Academy" : data.name}`;
  const row = { Name: rowHeaderCell(staticCellStyle(data.color), name) };

  for (const level of levels) {
    const guest = new PlayerData();

    [...Array(level + 1).keys()]
      .map((l) => researchEvents(ResearchField.Diplomacy, l, Expansion.Frontiers))
      .forEach((events, l) => {
        for (const e of events) {
          guest.gainRewards(e.rewards);
        }
      });

    const cost = tradeCost(guest, option).toString();
    const rewards = tradeRewards(option, guest, guest);
    const bld = option.build;
    const buildDesc = bld
      ? `<br/>Build ${buildingData[bld].name} for ${factionBoard(Faction.Terrans).buildings[bld].cost.join(",")}`
      : "";
    const academy = option.researchAdvancementBonus ? ` *` : "";
    row[level] = `${cost}: ${rewards.join(",")}${buildDesc}${academy}`;
  }

  return row;
}

export function tradeRewardItems(engine: Engine): any[] {
  return tradeOptions.map((option) => row(option));
}
