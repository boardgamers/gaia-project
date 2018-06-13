import {Hex, Grid} from "hexagrid";
import { Planet, Building } from "./enums";

export interface GaiaHexData {
  planet: Planet,
  sector: string,
  building?: Building
}

export default class Sector {
  /**
   * Generates a new sector
   * 
   * @param definition The contents of the sector
   * @param id The id of the sector
   */
  public static create(definition: Planet[] | string, name: string, center = {q:0, r:0, s: 0}): Grid<GaiaHexData> {
    const GaiaHex = Hex.extend<GaiaHexData>({planet: Planet.Empty, sector: name});
    
    // Converts a string like eee,dsee,eeere,eeem,ove into an array of array of planets
    if (typeof definition === "string") {
      definition = definition.split("") as Planet[];
    }

    //flatten the array
    const planetArray: Planet[] = [].concat(...definition);
    const dataArray = planetArray.map(planet => ({planet, sector: name}));
    const grid = new Grid<GaiaHexData>(...GaiaHex.hexagon(2, {center, data: dataArray}));

    return grid;
  }
}
