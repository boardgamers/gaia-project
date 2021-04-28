import { Building } from "@gaia-project/engine";

export function buildingName(building: Building): string {
  switch (building) {
    case Building.Mine:
      return "mine";
    case Building.Academy1:
      return "academy1";
    case Building.Academy2:
      return "academy2";
    case Building.TradingStation:
      return "trading station";
    case Building.ResearchLab:
      return "research lab";
    case Building.PlanetaryInstitute:
      return "planetary institute";
    case Building.GaiaFormer:
      return "gaia-former";
    case Building.SpaceStation:
      return "space station";
  }
}

export function buildingShortcut(building: Building): string {
  switch (building) {
    case Building.Mine:
      return "m";
    case Building.Academy1:
      return "1";
    case Building.Academy2:
      return "2";
    case Building.TradingStation:
      return "t";
    case Building.ResearchLab:
      return "r";
    case Building.PlanetaryInstitute:
      return "i";
    case Building.GaiaFormer:
      return "g";
    case Building.SpaceStation:
      return "s";
  }
}
