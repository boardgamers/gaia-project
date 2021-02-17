import Event from "./events";
import PlayerData from "./player-data";
import Reward from "./reward";
import { Resource } from "./enums";
import { Settings } from "./player";
import { combinations } from "./utils";
import assert from "assert";

export class IncomeSelection {
  private constructor(
    readonly needed: boolean,
    readonly autoplayEvents: () => Event[],
    readonly descriptions: Reward[],
    readonly remainingChargesAfterIncome: number
  ) {}

  static create(data: PlayerData, settings: Settings, events: Event[]): IncomeSelection {
    // we need to check if rewards contains Resource.GainToken and Resource.GainPower
    // player has to select the order
    const notActivated = events.filter((ev) => !ev.activated);

    const gainTokens = notActivated.filter((ev) => ev.rewards.some((rw) => rw.type === Resource.GainToken));
    const chargePowers = notActivated.filter((ev) => ev.rewards.some((rw) => rw.type === Resource.ChargePower));

    return new IncomeSelection(
      gainTokens.length !== 0 && chargePowers.length !== 0,
      () => {
        if (!settings.autoIncome) {
          assert(false, "auto income was called, but it's not enabled for the player");
        }
        return calculateAutoIncome(data, gainTokens, chargePowers);
      },
      descriptions(gainTokens, chargePowers),
      remainingChargesAfterIncome(data.clone(), gainTokens, chargePowers)
    );
  }
}

function descriptions(gainTokens: Event[], chargePowers: Event[]) {
  return [
    ...gainTokens.map((ev) => ev.rewards.find((rw) => rw.type === Resource.GainToken)),
    ...chargePowers.map((ev) => ev.rewards.find((rw) => rw.type === Resource.ChargePower)),
  ];
}

function remainingChargesAfterIncome(data: PlayerData, gainTokens: Event[], chargePowers: Event[]): number {
  applyGainTokens(data, gainTokens);
  const waste = applyChargePowers(data, chargePowers);
  if (waste > 0) {
    return -waste;
  }
  return 100 - applyChargePowers(data, Event.parse(["+100pw"], null));
}

function runIncomeSimulation(data: PlayerData, beforeCharge: Event[], chargePowers: Event[], allGainTokens: Event[]) {
  applyGainTokens(data, beforeCharge);
  const waste = applyChargePowers(data, chargePowers);
  const gainAfterCharge = allGainTokens.filter((event) => !beforeCharge.includes(event));
  applyGainTokens(data, gainAfterCharge);
  return { waste: waste, power: data.power, events: beforeCharge.concat(chargePowers).concat(gainAfterCharge) };
}

/**
 * Calculates income using the following priority:
 *
 * 1. Wastes the least amount of power tokens
 * 2. Put the most power tokens in bowl 3
 */
export function calculateAutoIncome(data: PlayerData, gainTokens: Event[], chargePowers: Event[]): Event[] {
  const possibleSequences = combinations(gainTokens).map((beforeCharge) =>
    runIncomeSimulation(data.clone(), beforeCharge, chargePowers, gainTokens)
  );

  let minWaste = Infinity;
  for (const s of possibleSequences) {
    minWaste = Math.min(minWaste, s.waste);
  }

  let maxCharge = null;
  for (const s of possibleSequences.filter((value) => value.waste == minWaste)) {
    if (maxCharge == null || s.power.area3 > maxCharge.power.area3) {
      maxCharge = s;
    }
  }
  return maxCharge.events;
}

function applyGainTokens(data: PlayerData, gainTokens: Event[]) {
  for (const e of gainTokens) {
    data.gainRewards(e.rewards);
  }
}

/**
 * Apply all the charge power events
 *
 * @return the amount of power wasted
 */
function applyChargePowers(data: PlayerData, chargePowers: Event[]): number {
  let waste = 0;
  for (const e of chargePowers) {
    for (const reward of e.rewards) {
      const power = reward.count;
      const charged = data.chargePower(power);
      waste += power - charged;
    }
  }
  return waste;
}
