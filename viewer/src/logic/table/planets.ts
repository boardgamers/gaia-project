import Engine, { Planet } from "@gaia-project/engine";
import { countBy } from "lodash";
import { planetNames, remainingPlanets } from "../../data/planets";
import { planetColorVar } from "../../graphics/colors";
import { defaultBackground, emptyCell, PlayerColumn, PlayerTable } from "./types";

export function planets(engine: Engine): PlayerTable {
  if (!engine.map) {
    return null;
  }

  const count = new Map(
    engine.players.map((p) => [
      p.player,
      countBy(
        Array.from(engine.map.grid.values()).filter(
          (hex) => hex.data.planet !== Planet.Empty && hex.data.player == p.player
        ),
        "data.planet"
      ),
    ])
  );

  return {
    caption: "Planets",
    columns: [
      {
        shortcut: "",
        color: defaultBackground,
        title: "Planet types, except transdim",
        cell: (p) => Object.keys(count.get(p.player)).filter((p) => p != Planet.Transdim).length,
        additionalHeader: { cells: [emptyCell] },
      } as PlayerColumn,
    ].concat(
      ...Object.values(Planet)
        .filter((planet) => planet != Planet.Empty)
        .map((planet) => {
          const color = planetColorVar(planet, false);
          return {
            shortcut: planet,
            title: planetNames[planet],
            color,
            cell: (p) => count.get(p.player)[planet] ?? "",
            additionalHeader: {
              cells: [
                {
                  shortcut: String(remainingPlanets(planet, engine)),
                  title: `Remaining ${planetNames[planet]} Planets`,
                  color,
                },
              ],
            },
          };
        })
    ),
  };
}
