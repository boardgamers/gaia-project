import {defineGrid, extendHex, HexCoordinates, Hex, Grid} from "honeycomb-grid";
import { Planet } from "./enums";

export interface GaiaHex {
  orientation: "flat",
  data: {
    planet: Planet,
    sector: number
  }
}

// flat-topped hexagons
const gridMaker = defineGrid(extendHex<GaiaHex>({orientation: "flat", data: {planet: Planet.Empty, sector: null}}));

export default class Sector {
  /**
   * Generates a new sector
   * 
   * @param definition The contents of the sector
   * @param id The id of the sector
   */
  public static create(definition: Planet[][] | string, id: number, center: HexCoordinates = {x:0, y:0}): Grid<Hex<GaiaHex>> {
    // Converts a string like eee,dsee,eeere,eeem,ove into an array of array of planets
    if (typeof definition === "string") {
      definition = definition.split(",").map(str => str.split("") as Planet[]);
    }

    //flatten the array
    const planetArray: Planet[] = [].concat(...definition);
    const grid = gridMaker.hexagon({radius: 2, center});

    for (let i = 0; i < planetArray.length; i++) {
      // Todo: check it's done in the right order. If not, maybe do a double loop with coordinates
      grid[i].data = {
        planet: planetArray[i],
        sector: id
      }
    }

    // Todo: randomly rotate grid

    return grid;
  }
}
