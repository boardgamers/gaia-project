import { Hex } from "hexagrid";
import { Planet, Building, Player } from "./enums";

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

  colonizedBy(player: Player): boolean {
    // TODO lantids
    return this.data.player === player;
  }
}
