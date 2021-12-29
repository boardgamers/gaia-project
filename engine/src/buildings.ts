import { Building, Faction } from "..";

export function upgradedBuildings(currentBuilding: Building, faction: Faction): Building[] {
  switch (currentBuilding) {
    case Building.GaiaFormer:
      return [Building.Mine];
    case Building.Mine:
      return [Building.TradingStation];
    case Building.TradingStation:
      return faction === Faction.Bescods
        ? [Building.Academy1, Building.Academy2, Building.ResearchLab]
        : [Building.PlanetaryInstitute, Building.ResearchLab];
    case Building.ResearchLab:
      return faction === Faction.Bescods ? [Building.PlanetaryInstitute] : [Building.Academy1, Building.Academy2];
  }

  return [];
}

export function stdBuildingValue(building: Building): number {
  switch (building) {
    case Building.Mine:
    case Building.CustomsPost:
      return 1;
    case Building.TradingStation:
    case Building.ResearchLab:
      return 2;
    case Building.PlanetaryInstitute:
    case Building.Academy1:
    case Building.Academy2:
    case Building.Colony:
      return 3;
  }

  return 0;
}
