import { Resource } from "./enums";
import { GaiaHex } from "./gaia-hex";
import SpaceMap from "./map";
import PlayerObject, { BuildWarning } from "./player";
import PlayerData from "./player-data";
import Reward from "./reward";

export const TERRAFORMING_COST = 3;
const QIC_RANGE_UPGRADE = 2;

export function terraformingCost(d: PlayerData, steps: number, replay: boolean): Reward | null {
  const oreNeeded = (temporaryStep: number) =>
    (TERRAFORMING_COST - d.terraformCostDiscount) * Math.max(steps - temporaryStep, 0);

  const cost = oreNeeded(d.temporaryStep);
  if (!replay && d.temporaryStep > 0 && oreNeeded(0) === cost) {
    // not allowed - see https://github.com/boardgamers/gaia-project/issues/76
    // OR (for booster) there's no reason to activate the booster and not use it
    return null;
  }
  return new Reward(cost, Resource.Ore);
}

export type QicNeeded = { amount: number; distance: number; warning?: BuildWarning };

export function qicForDistance(
  map: SpaceMap,
  hex: GaiaHex,
  pl: PlayerObject,
  replay: boolean,
  temporaryRange = pl.data.temporaryRange
): QicNeeded | null {
  const distance = (acceptGaiaFormer: boolean) => {
    const hexes = acceptGaiaFormer
      ? Array.from(map.grid.values()).filter((loc) => loc.data.player === pl.player)
      : pl.data.occupied.filter((loc) => acceptGaiaFormer || loc.isRangeStartingPoint(pl.player));
    return Math.min(...hexes.map((loc) => map.distance(hex, loc)));
  };

  function qic(temporaryRange: number, distance: number): number {
    return Math.max(Math.ceil((distance - pl.data.range - temporaryRange) / QIC_RANGE_UPGRADE), 0);
  }

  const d = distance(false);
  const qicNeeded = qic(temporaryRange, d);
  if (!replay && temporaryRange > 0 && qic(0, distance(false)) === qicNeeded) {
    // there's no reason to activate the booster and not use it
    return null;
  }
  const qicWithGaiaFormer = qic(temporaryRange, distance(true));
  return {
    amount: qicNeeded,
    distance: d,
    warning: qicWithGaiaFormer < qicNeeded ? BuildWarning.gaiaFormerWouldExtendRange : null,
  };
}
