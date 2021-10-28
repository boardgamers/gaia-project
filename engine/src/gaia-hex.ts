import assert from "assert";
import { Hex } from "hexagrid";
import { stdBuildingValue } from "./buildings";
import { Building, Planet, Player, TradeToken } from "./enums";

type PlayerShip = { player: Player; ship: Building };

export interface GaiaHexData {
  planet: Planet;
  sector: string;
  building?: Building;
  /** Who occupies the spot */
  player?: Player;
  /** List of players who have a federation occupying this square */
  federations?: Player[];
  ships?: PlayerShip[];
  tradeTokens?: Array<Player | TradeToken>;
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
    return [this.data.player, this.data.additionalMine].filter((x) => x !== undefined);
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

  addToFederationOf(player: Player): boolean {
    if (this.belongsToFederationOf(player)) {
      return false;
    }
    if (this.data.federations) {
      this.data.federations.push(player);
    } else {
      this.data.federations = [player];
    }
    return true;
  }

  addShip(ship: Building, player: Player) {
    const s = this.playerShip(ship, player);
    if (this.data.ships) {
      this.data.ships.push(s);
    } else {
      this.data.ships = [s];
    }
  }

  ships() {
    return this.data.ships ?? [];
  }

  private playerShip(ship: Building, player: Player) {
    return { ship, player } as PlayerShip;
  }

  addTradeToken(player: Player | TradeToken.Wild) {
    if (this.data.tradeTokens) {
      this.data.tradeTokens.push(player);
    } else {
      this.data.tradeTokens = [player];
    }
  }

  hasTradeToken(player: Player) {
    return this.data.tradeTokens && this.data.tradeTokens.includes(player);
  }

  hasWildTradeToken() {
    return this.data.tradeTokens && this.data.tradeTokens.includes(TradeToken.Wild);
  }

  hasTradeTokens() {
    return this.data.tradeTokens && this.data.tradeTokens.length > 0;
  }

  removeShip(ship: Building, player: Player) {
    if (this.data.ships.length === 1) {
      this.data.ships = undefined;
    } else {
      this.data.ships.splice(this.data.ships.indexOf(this.playerShip(ship, player)), 1);
    }
  }

  // Can probably math this better
  get relativeCoordinates() {
    const horizontal = { q: -3, r: 5 };
    const vertical = { q: 2, r: 3 };
    const diagonal = { q: 5, r: -2 };

    const current = { q: this.q, r: this.r };

    let counter = 0;
    while (counter++ < 10 && magnitude(current.q, current.r) > 2) {
      for (const direction of [horizontal, vertical, diagonal]) {
        while (magnitude(current.q - direction.q, current.r - direction.r) < magnitude(current.q, current.r)) {
          current.q -= direction.q;
          current.r -= direction.r;
        }
        while (magnitude(current.q + direction.q, current.r + direction.r) < magnitude(current.q, current.r)) {
          current.q += direction.q;
          current.r += direction.r;
        }
      }
    }

    return current;
  }

  toString() {
    const relative = this.relativeCoordinates;
    const suffix = suffixes[`${relative.q}x${relative.r}`];

    assert(suffix, `Can't find suffix for ${this.q}x${this.r} ${relative.q}x${relative.r}`);
    return [this.data.sector.replace(/[AB]$/, ""), suffixes[`${relative.q}x${relative.r}`]].join("");
  }
}

const suffixes = {
  "2x0": "A0",
  "1x1": "A1",
  "0x2": "A2",
  "-1x2": "A3",
  "-2x2": "A4",
  "-2x1": "A5",
  "-2x0": "A6",
  "-1x-1": "A7",
  "0x-2": "A8",
  "1x-2": "A9",
  "2x-2": "A10",
  "2x-1": "A11",
  "1x0": "B0",
  "0x1": "B1",
  "-1x1": "B2",
  "-1x0": "B3",
  "0x-1": "B4",
  "1x-1": "B5",
  "0x0": "C",
};

const reverseSuffixes = Object.keys(suffixes).reduce((acc, key) => ({ ...acc, [suffixes[key]]: key }), {});

export { reverseSuffixes };

function magnitude(q: number, r: number) {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}
