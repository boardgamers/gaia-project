import Engine, {
  Building,
  Command,
  Expansion,
  GaiaHex,
  PlayerData,
  ShipAction,
  stdBuildingValue,
} from "@gaia-project/engine";
import { allBuildings, buildingData } from "../../data/building";
import { CommandObject } from "../recent";
import { ChartSource } from "./charts";
import { ExtractLog, ExtractLogArg, SimpleSourceFactory } from "./simple-charts";

function buildingFromLog(e: ExtractLogArg<ChartSource<Building>>): Building | null {
  const args = e.cmd.args;
  switch (e.cmd.command) {
    case Command.Build:
      return args[0] as Building;
    case Command.MoveShip:
      if (e.log.changes?.[Command.Build] != null) {
        return Building.CustomsPost;
      }
      if (args.some((a) => a === ShipAction.BuildColony)) {
        return Building.Colony;
      }
      return null;
  }
  return null;
}

export const buildingsSourceFactory = (expansion: Expansion): SimpleSourceFactory<ChartSource<Building>> => {
  return {
    name: "Buildings",
    playerSummaryLineChartTitle: "Power value of all buildings of all players (1-3 base power value)",
    showWeightedTotal: true,
    extractLog: ExtractLog.filterPlayer((e) => {
      return buildingFromLog(e) === e.source.type ? 1 : 0;
    }),
    sources: allBuildings(expansion, true).map((b) => ({
      type: b,
      label: buildingData[b].name,
      color: buildingData[b].color,
      weight: stdBuildingValue(b),
    })),
  };
};

export class BuildingCounter {
  initialPlanetaryInstituteLocation?: GaiaHex;
  planetaryInstituteLocation?: GaiaHex;
  buildings: Map<GaiaHex, Building> = new Map<GaiaHex, Building>();
  playerData: PlayerData;

  constructor(playerData: PlayerData = new PlayerData()) {
    this.playerData = playerData;
  }

  get(hex: GaiaHex): Building | null {
    return this.buildings.get(hex);
  }

  playerCommand(cmd: CommandObject, data: Engine) {
    switch (cmd.command) {
      case Command.Build:
        {
          const building = cmd.args[0] as Building;
          const hex = data.map.getS(cmd.args[1]);

          this.playerData.buildings[building]++;
          const upgradedBuilding = this.buildings.get(hex);

          if (upgradedBuilding != null) {
            this.playerData.buildings[upgradedBuilding]--;
          }

          this.buildings.set(hex, building);

          if (building == Building.PlanetaryInstitute) {
            this.initialPlanetaryInstituteLocation = hex;
            this.planetaryInstituteLocation = hex;
          }
        }
        break;
      case Command.PISwap:
        {
          const hex = data.map.getS(cmd.args[0]);
          this.buildings.set(this.planetaryInstituteLocation, Building.Mine);
          this.buildings.set(hex, Building.PlanetaryInstitute);
          this.planetaryInstituteLocation = hex;
        }
        break;
    }
  }
}
