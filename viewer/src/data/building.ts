import { AvailableBuilding, Building, Faction } from "@gaia-project/engine";

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
  }
}
