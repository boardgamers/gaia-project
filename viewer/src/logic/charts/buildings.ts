import { Building, Command, Expansion, stdBuildingValue } from "@gaia-project/engine";
import { allBuildings, buildingData } from "../../data/building";
import { ChartSource } from "./charts";
import { ExtractLog, SimpleSourceFactory } from "./simple-charts";

export const buildingsSourceFactory = (expansion: Expansion): SimpleSourceFactory<ChartSource<Building>> => {
  return {
    name: "Buildings",
    playerSummaryLineChartTitle: "Power value of all buildings of all players (1-3 base power value)",
    showWeightedTotal: true,
    extractLog: ExtractLog.filterPlayer((e) => {
      if (e.cmd.command == Command.Build) {
        const t = e.cmd.args[0] as Building;
        if (e.source.type == t) {
          return 1;
        }
      }
      return 0;
    }),
    sources: allBuildings(expansion, true).map((b) => ({
      type: b,
      label: buildingData[b].name,
      color: buildingData[b].color,
      weight: stdBuildingValue(b),
    })),
  };
};
