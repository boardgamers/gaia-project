import { Planet } from "@gaia-project/engine";
import { planetNames } from "../../data/planets";
import { ChartSource, planetColor } from "./charts";
import { planetCounter, SimpleSourceFactory } from "./simple-charts";

export const planetsSourceFactory: SimpleSourceFactory<ChartSource<Planet>> = {
  name: "Planets",
  playerSummaryLineChartTitle: "Planets of all players",
  showWeightedTotal: false,
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
        color: planetColor(planet, true),
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
