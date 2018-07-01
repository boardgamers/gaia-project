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

export type GaiaHex = Hex<GaiaHexData>;