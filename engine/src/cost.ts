import { Resource } from "./enums";
import PlayerData from "./player-data";
import Reward from "./reward";

const TERRAFORMING_COST = 3;
const QIC_RANGE_UPGRADE = 2;

export function terraformingCost(d: PlayerData, steps: number): Reward | null {
  const oreNeeded = (temporaryStep: number) =>
    (TERRAFORMING_COST - d.terraformCostDiscount) * Math.max(steps - temporaryStep, 0);

  const cost = oreNeeded(d.temporaryStep);
  if (d.temporaryStep > 0 && oreNeeded(0) == cost) {
    return null;
  }
  return new Reward(cost, Resource.Ore);
}

export function qicForDistance(distance: number, data: PlayerData): number | null {
  function qic(temporaryRange: number) {
    return Math.max(Math.ceil((distance - data.range - temporaryRange) / QIC_RANGE_UPGRADE), 0);
  }

  const qicNeeded = qic(data.temporaryRange);
  if (data.temporaryRange > 0 && qic(0) == qicNeeded) {
    // there's no reason to activate the booster and not use it
    return null;
  }
  return qicNeeded;
}
