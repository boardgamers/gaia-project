import { AvailableBuilding, Building, Building as BuildingEnum, Faction, isShip } from "@gaia-project/engine";
import { ShipAction } from "@gaia-project/engine/src/available-command";

export function buildingName(building: Building, faction: Faction): string {
  switch (building) {
    case Building.Mine:
      return "Mine";
    case Building.Academy1:
      return "Knowledge Academy";
    case Building.Academy2:
      return faction == Faction.BalTaks ? "Credit Academy" : "QIC Academy";
    case Building.TradingStation:
      return "Trading Station";
    case Building.ResearchLab:
      return "Research Lab";
    case Building.PlanetaryInstitute:
      return "Planetary Institute";
    case Building.GaiaFormer:
      return "Gaia Former";
    case Building.SpaceStation:
      return "Space Station";
    case Building.Colony:
      return "Colony";
    case Building.ColonyShip:
      return "Colony Ship";
    case Building.ConstructionShip:
      return "Construction Ship";
    case Building.ResearchShip:
      return "Research Ship";
    case Building.TradeShip:
      return "Trade Ship";
    case Building.Scout:
      return "Scout";
    case Building.Frigate:
      return "Frigate";
    case Building.BattleShip:
      return "Battle Ship";
  }
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
    case ShipAction.BuildColony:
      return "Build <u>C</u>olony";
  }
}

export function buildingShortcut(b: AvailableBuilding, faction: Faction): string {
  if (b.downgrade) {
    return "d";
  }
  const building = b.building;
  if (b.upgrade && building == Building.Mine) {
    return "u";
  }
  if (isShip(building)) {
    return shipLetter(building).toLowerCase();
  }
  switch (building) {
    case Building.Mine:
      return "m";
    case Building.Academy1:
      return "k";
    case Building.Academy2:
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
      return "s";
  }
}
