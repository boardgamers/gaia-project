import {
  AvailableBuilding,
  Building,
  Building as BuildingEnum,
  Expansion,
  Faction,
  isShip,
  ShipAction,
} from "@gaia-project/engine";
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
  [Building.Colony]: {
    name: "Colony",
    color: "--rt-nav",
  },
  [Building.CustomsPost]: {
    name: "Customs Post",
    color: "--res-credit",
  },
  [Building.ColonyShip]: {
    name: "Colony Ship",
    color: "--rt-gaia",
  },
  [Building.ConstructionShip]: {
    name: "Construction Ship",
    color: "--current-round",
  },
  [Building.ResearchShip]: {
    name: "Research Ship",
    color: "--current-round",
  },
  [Building.TradeShip]: {
    name: "Trade Ship",
    color: colorCodes.tradeShip.color,
  },
  [Building.Scout]: {
    name: "Scout",
    color: "--current-round",
  },
  [Building.Frigate]: {
    name: "Frigate",
    color: "--current-round",
  },
  [Building.BattleShip]: {
    name: "Battle Ship",
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

export function shipLetter(building: BuildingEnum): string {
  switch (building) {
    case BuildingEnum.ColonyShip:
      return "L";
    case BuildingEnum.TradeShip:
      return "T";
    case BuildingEnum.ConstructionShip:
      return "C";
    case BuildingEnum.ResearchShip:
      return "R";
    case BuildingEnum.Scout:
      return "S";
    case BuildingEnum.Frigate:
      return "F";
    case BuildingEnum.BattleShip:
      return "B";
  }
}

export function shipActionName(action: ShipAction): string {
  switch (action) {
    case ShipAction.Nothing:
      return "<u>D</u>ecline";
    case ShipAction.BuildColony:
      return "Build <u>C</u>olony";
    case ShipAction.Trade:
      return "<u>T</u>rade";
  }
}

export function buildingShortcut(building: Building, faction?: Faction): string {
  if (isShip(building)) {
    return shipLetter(building).toLowerCase();
  }
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
    case Building.Colony:
      return "c";
    case Building.CustomsPost:
      return "u";
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
