import { Building, Command } from "@gaia-project/engine";
import { ChartSource } from "./charts";
import { SimpleSourceFactory, statelessExtractLog } from "./simple-charts";

export const buildingsSourceFactory: SimpleSourceFactory<ChartSource<Building>> = {
  name: "Buildings",
  playerSummaryLineChartTitle: "Power value of all buildings of all players (1-3 base power value)",
  showWeightedTotal: true,
  extractLog: statelessExtractLog((e) => {
    if (e.cmd.command == Command.Build) {
      const t = e.cmd.args[0] as Building;
      if (e.source.type == t) {
        return 1;
      }
    }
    return 0;
  }),
  sources: [
    {
      type: Building.Mine,
      label: "Mine",
      color: "--res-ore",
      weight: 1,
    },
    {
      type: Building.TradingStation,
      label: "Trading Station",
      color: "--res-credit",
      weight: 2,
    },
    {
      type: Building.ResearchLab,
      label: "Research Lab",
      color: "--res-knowledge",
      weight: 2,
    },
    {
      type: Building.PlanetaryInstitute,
      label: "Planetary Institute",
      color: "--current-round",
      weight: 3,
    },
    {
      type: Building.Academy1,
      label: "Academy 1",
      color: "--rt-terra",
      weight: 3,
    },
    {
      type: Building.Academy2,
      label: "Academy 2",
      color: "--res-qic",
      weight: 3,
    },
    {
      type: Building.GaiaFormer,
      label: "Gaia Former",
      color: "--rt-gaia",
      weight: 0,
    },
  ],
};
