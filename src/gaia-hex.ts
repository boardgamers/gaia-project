import { Hex } from "hexagrid";
import { Planet, Building, Player } from "./enums";
import { stdBuildingValue } from "./buildings";

export interface GaiaHexData {
  planet: Planet;
  sector: string;
  building?: Building;
  /** Who occupies the spot */
  player?: Player;
  /** List of players who have a federation occupying this square */
  federations?: Player[];
  /** Additional mine of lantids */
  additionalMine?: Player;
}

export class GaiaHex extends Hex<GaiaHexData> {
  constructor(q?: number, r?: number, data?: GaiaHexData) {
    super(q, r, data);
  }

  hasPlanet(): boolean {
    return this.data.planet !== Planet.Empty;
  }

  occupied(): boolean {
    return this.data.player !== undefined;
  }

  occupyingPlayers(): Player[] {
    if (this.data.player === undefined) {
      return [];
    }
    if (this.buildingOf(this.data.player) === Building.GaiaFormer) {
      // Gaia former is the only building which doesn't extend range and is not counted
      // into federations
      return [];
    }
    return [this.data.player, this.data.additionalMine].filter(x => x !== undefined);
  }

  // Space stations do not count as colonized, gaia-formers do not count as colonized
  colonizedBy(player: Player): boolean {
    // Neither space stations nor gaia formers have a building value, and every building with a building
    // value counts as colonized.
    return stdBuildingValue(this.buildingOf(player)) > 0;
  }

  isMainOccupier(player: Player): boolean {
    return this.colonizedBy(player) && this.data.additionalMine !== player;
  }

  /** Space stations are not structures, so a trading station built near one will still be isolated */
  hasStructure(): boolean {
    return this.occupied && this.data.building !== Building.GaiaFormer && this.data.building !== Building.SpaceStation;
  }

  /**
   * Can the player use this hex as a starting point to create new buildings?
   * @param player
   */
  isRangeStartingPoint(player: Player): boolean {
    return this.colonizedBy(player) || this.buildingOf(player) === Building.SpaceStation;
  }

  buildingOf(player: Player): Building {
    if (this.data.additionalMine === player) {
      return Building.Mine;
    }
    if (this.data.player !== player) {
      return undefined;
    }

    return this.data.building;
  }

  belongsToFederationOf(player: Player): boolean {
    return this.data.federations && this.data.federations.includes(player);
  }

  addToFederationOf(player: Player) {
    if (this.belongsToFederationOf(player)) {
      return;
    }
    if (this.data.federations) {
      this.data.federations.push(player);
    } else {
      this.data.federations = [player];
    }
  }
}
