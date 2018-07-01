import { Hex } from "hexagrid";
import { Planet, Building, Player } from "./enums";
import { stdBuildingValue } from "./buildings";

export interface GaiaHexData {
  planet: Planet,
  sector: string,
  building?: Building,
  /** Who occupies the spot */
  player?: Player,
  /** List of players who have a federation occupying this square */
  federations?: Player[]
}

export class GaiaHex extends Hex<GaiaHexData> {
  constructor(q?: number, r?: number, data?: GaiaHexData) {
    super(q, r, data);
  }

  hasPlanet(): boolean {
    return this.data.planet !== Planet.Empty;
  }

  // Space stations do not count as colonized, gaia-formers do not count as colonized
  colonizedBy(player: Player): boolean {
    // Neither space stations nor gaia formers have a building value, and every building with a building
    // value counts as colonized.
    return stdBuildingValue(this.buildingOf(player)) > 0;
  }

  buildingOf(player: Player): Building {
    // TODO lantids
    if (this.data.player !== player) {
      return undefined;
    }

    return this.data.building;
  }
}
