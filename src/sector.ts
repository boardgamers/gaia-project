import {defineGrid, extendHex} from "honeycomb-grid";
import { Planet } from "./enums";

// flat-topped hexagons
const Grid = defineGrid(extendHex({orientation: "flat"}));

export default class Sector {
  /**
   * Generates a new sector
   * 
   * @param definition The contents of the sector
   * @param id The id of the sector
   */
  public static create(definition: Planet[][] | string, id: number) {
    // Converts a string like eee,dsee,eeere,eeem,ove into an array of array of planets
    if (typeof definition === "string") {
      definition = definition.split(",").map(str => str.split("") as Planet[]);
    }

    //flatten the array
    const planetArray: Planet[] = [].concat(...definition);
    const grid = Grid.hexagon({radius: 2});

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
