import { QicNeeded } from "./cost";
import { EventSource } from "./events";
import { GaiaHex } from "./gaia-hex";
import SpaceMap from "./map";
import Player from "./player";
import { Faction, PowerArea, Resource, Spaceship } from "./enums";
import Reward from "./reward";
import { EXPLORATION_CHARGE_TRACK } from "./spaceships";

const QIC_RANGE_UPGRADE = 2;

export function maxExplorationShuttles(nbPlayers: number): number {
  return nbPlayers === 2 ? 2 : 3;
}

export function spaceshipHex(map: SpaceMap, ship: Spaceship): GaiaHex | undefined {
  return [...map.grid.values()].find((hex) => hex.data.spaceship === ship);
}

export function nextFreeExplorationSlot(players: Player[], ship: Spaceship): number | null {
  const occupiedSlots = new Set(players.map((pl) => pl.data.explorationShips[ship]).filter((slot) => slot !== undefined));

  for (let slot = 1; slot <= EXPLORATION_CHARGE_TRACK.length; slot++) {
    if (!occupiedSlots.has(slot)) {
      return slot;
    }
  }

  return null;
}

export function qicForExplorationDistance(
  map: SpaceMap,
  hex: GaiaHex,
  pl: Player,
  replay: boolean,
  temporaryRange = pl.data.temporaryRange
): QicNeeded | null {
  const origins = pl.data.occupied.filter((loc) => loc.colonizedBy(pl.player));

  if (origins.length === 0) {
    return null;
  }

  const distance = Math.min(...origins.map((loc) => map.distance(hex, loc)));
  const qic = (rangeBoost: number) => Math.max(Math.ceil((distance - pl.data.range - rangeBoost) / QIC_RANGE_UPGRADE), 0);
  const amount = qic(temporaryRange);

  if (!replay && temporaryRange > 0 && qic(0) === amount) {
    return null;
  }

  return {
    amount,
    distance,
  };
}

export function explorationCost(pl: Player): Reward[] {
  const cost = [new Reward(pl.faction === Faction.BalTaks ? 7 : 5, Resource.VictoryPoint)];

  if (pl.faction === Faction.Nevlas || pl.faction === Faction.Itars) {
    cost.push(new Reward(1, Resource.GainToken));
  }

  return cost;
}

export function canPayExplorationCost(pl: Player, cost: Reward[]): boolean {
  if (pl.faction === Faction.Taklons && pl.data.brainstone === PowerArea.Gaia) {
    return false;
  }

  return pl.data.canPay(cost);
}

export function explorationCostAdjustments(pl: Player): string[] {
  const adjustments: string[] = [];

  if (pl.faction === Faction.Taklons && pl.data.brainstone !== PowerArea.Gaia) {
    adjustments.push("brainstone -> gaia");
  }

  return adjustments;
}

export function deployExplorationShuttle(pl: Player, ship: Spaceship, slot: number, source: EventSource) {
  pl.data.explorationShips[ship] = slot;

  if (pl.faction === Faction.Taklons && pl.data.brainstone !== PowerArea.Gaia) {
    pl.data.brainstoneDest = PowerArea.Gaia;
    pl.data.gainReward(new Reward(1, Resource.MoveTokenToGaiaArea), true, source);
  }

  const charge = EXPLORATION_CHARGE_TRACK[slot - 1];
  if (charge > 0) {
    pl.gainRewards([new Reward(charge, Resource.ChargePower)], source);
  }
}
