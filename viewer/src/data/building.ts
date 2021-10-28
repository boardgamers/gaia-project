import { AvailableBuilding, Building, Building as BuildingEnum, Faction } from "@gaia-project/engine";

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

export function buildingShortcut(building: AvailableBuilding): string {
  if (building.downgrade) {
    return "d";
  }
  if (building.upgrade && building.building == Building.Mine) {
    return "u";
  }
  switch (building.building) {
    case Building.Mine:
      return "m";
    case Building.Academy1:
    case Building.Academy2:
      return "c";
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
    case Building.ColonyShip:
      return "1";
    case Building.ConstructionShip:
      return "2";
    case Building.ResearchShip:
      return "3";
    case Building.TradeShip:
      return "4";
    case Building.Scout:
      return "5";
    case Building.Frigate:
      return "6";
    case Building.BattleShip:
      return "7";
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
