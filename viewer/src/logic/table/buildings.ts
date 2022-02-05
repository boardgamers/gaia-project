import Engine, { Building, factionBoard, factionVariantBoard, Player } from "@gaia-project/engine";
import { buildingDesc } from "../../data/factions";
import { RichText } from "../../graphics/utils";
import { allBuildings, buildingData, buildingName, buildingShortcut } from "../../data/building";
import { PlayerTable } from "./types";
import { skipZero } from "./util";

function buildingTooltip(p: Player, engine: Engine, b: Building): string {
  const faction = p.faction;
  if (!faction) {
    return "";
  }
  const variant = p?.variant?.board ?? factionVariantBoard(engine.factionCustomization, faction)?.board;
  return ": " + buildingDesc(b, faction, factionBoard(faction, variant), p);
}

function gaiaFormers(p: Player): string {
  const total = p.data.gaiaformers;
  const available = total - p.data.buildings.gf - p.data.gaiaformersInGaia;
  if (available == 0 && total == 0) {
    return "";
  }
  return `${available}/${total}`;
}

function building(b: Building, p: Player, compact: boolean): string | RichText {
  if (b == Building.GaiaFormer) {
    return gaiaFormers(p);
  }
  const count = p.data.buildings[b];

  if (compact) {
    return skipZero(count);
  }
  if (count === 0) {
    return [];
  }

  return [
    {
      building: {
        type: b,
        faction: p.faction,
        count,
      },
    },
  ];
}

export function buildings(engine: Engine, compact: boolean): PlayerTable {
  return {
    caption: "Buildings",
    columns: allBuildings(engine.expansions, true).map((b) => {
      const color = buildingData[b].color;
      const title = buildingData[b].name;
      return {
        shortcut: buildingShortcut(b),
        title,
        color,
        cell: (p) => [
          {
            shortcut: building(b, p, compact),
            title: `${buildingName(b, p.faction)}${buildingTooltip(p, engine, b)}`,
            color,
          },
        ],
      };
    }),
  };
}
