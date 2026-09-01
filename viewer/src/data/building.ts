import type { AvailableBuilding } from "@gaia-project/engine";
import { Building, Expansion, Faction } from "@gaia-project/engine";
import { colorCodes } from "../logic/color-codes";

export const buildingData: { [key in Building]: { name: string; color: string } } = {
  [Building.Mine]: {
    name: "Mine",
    color: "--res-ore",
  },
  [Building.TradingStation]: {
    name: "Trading Station",
    color: "--res-credit",
  },
  [Building.ResearchLab]: {
    name: "Research Lab",
    color: "--res-knowledge",
  },
  [Building.PlanetaryInstitute]: {
    name: "Planetary Institute",
    color: "--current-round",
  },
  [Building.Academy1]: {
    name: "Knowledge Academy",
    color: "--rt-terra",
  },
  [Building.Academy2]: {
    name: "Academy 2",
    color: "--res-qic",
  },
  [Building.GaiaFormer]: {
    name: "Gaia Former",
    color: "--gaia",
  },
  [Building.SpaceStation]: {
    name: "Space Station",
    color: "--current-round",
  },
};

export function allBuildings(expansion: Expansion, gaiaFormer: boolean) {
  return Building.values(expansion).filter(
    (bld) => (bld !== Building.GaiaFormer || gaiaFormer) && bld !== Building.SpaceStation
  );
}

export function buildingName(building: Building, faction: Faction): string {
  if (building === Building.Academy2 && faction != null) {
    return faction == Faction.BalTaks ? "Credit Academy" : "QIC Academy";
  }
  return buildingData[building].name;
}

export function buildingShortcut(building: Building, faction?: Faction): string {
  switch (building) {
    case Building.Mine:
      return "m";
    case Building.Academy1:
      if (faction == null) {
        return "1";
      }
      return "k";
    case Building.Academy2:
      if (faction == null) {
        return "2";
      }
      return faction == Faction.BalTaks ? "c" : "q";
    case Building.TradingStation:
      return "t";
    case Building.ResearchLab:
      return "l";
    case Building.PlanetaryInstitute:
      return "i";
    case Building.GaiaFormer:
      return "g";
    case Building.SpaceStation:
      return colorCodes.spaceStation.shortcut;
  }
}

export function availableBuildingShortcut(b: AvailableBuilding, faction: Faction): string {
  if (b.downgrade) {
    return "d";
  }
  const building = b.building;
  if (b.upgrade && building == Building.Mine) {
    return "u";
  }
  return buildingShortcut(building, faction);
}
