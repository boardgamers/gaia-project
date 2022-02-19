import { Planet } from "@gaia-project/engine";
import { planetNames } from "../../data/planets";
import { planetColorVar } from "../../graphics/colors";
import { ChartSource } from "./charts";
import { ChartSummary, planetCounter, SimpleSourceFactory } from "./simple-charts";

export const planetsSourceFactory: SimpleSourceFactory<ChartSource<Planet>> = {
  name: "Planets",
  playerSummaryLineChartTitle: "Planets of all players",
  summary: ChartSummary.total,
  extractLog: planetCounter(
    (source) => source.type == Planet.Empty,
    (source) => source.type == Planet.Lost,
    (p, t) => p == t
  ),
  sources: Object.keys(planetNames)
    .map((t) => {
      const planet = t as Planet;
      return {
        type: planet,
        label: `${planetNames[planet]}`,
        color: planetColorVar(planet, true),
        weight: 1,
      };
    })
    .concat({
      type: Planet.Empty,
      label: "Lantids guest mine",
      color: "--recent",
      weight: 1,
    }),
};
