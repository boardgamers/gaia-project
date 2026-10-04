import { Faction, Resource } from "./enums";
import Event from "./events";
import { Settings } from "./player";
import PlayerData, { Power } from "./player-data";
import Reward from "./reward";
import { combinations } from "./utils";
import assert from "./utils/assert";

export class IncomeSelection {
  private constructor(
    readonly needed: boolean,
    readonly autoplayEvents: () => Event[],
    readonly descriptions: Reward[],
    readonly remainingChargesAfterIncome: number,
    readonly canAutoplay: boolean
  ) {}

  static create(
    data: PlayerData,
    settings: Settings,
    events: Event[],
    additionalEvents?: Event[],
    faction?: Faction
  ): IncomeSelection {
    // we need to check if rewards contains Resource.GainToken and Resource.GainPower
    // player has to select the order
    const notActivated = events.filter((ev) => !ev.activated);
    if (additionalEvents) {
      notActivated.push(...additionalEvents);
    }

    const gainTokens = notActivated.filter((ev) => ev.rewards.some((rw) => rw.type === Resource.GainToken));
    const chargePowers = notActivated.filter((ev) => ev.rewards.some((rw) => rw.type === Resource.ChargePower));
    const remainingCharges = remainingChargesAfterIncome(data.clone(), gainTokens, chargePowers);
    const needed = gainTokens.length !== 0 && chargePowers.length !== 0;
    const automaticEvents =
      !settings.autoIncome && needed
        ? dominantIncomeOrder(data, gainTokens.concat(chargePowers), faction === Faction.Itars)
        : undefined;
    const canAutoplay = settings.autoIncome || !!automaticEvents;

    return new IncomeSelection(
      needed,
      () => {
        if (!canAutoplay) {
          assert(false, "income requires a choice, but auto income is not enabled for the player");
        }
        if (automaticEvents) return automaticEvents;
        return calculateAutoIncome(data, gainTokens, chargePowers);
      },
      descriptions(gainTokens, chargePowers),
      remainingCharges,
      canAutoplay
    );
  }
}

/** Resolve only orders with no trade-off, leaving the player's auto-income heuristic opt-in. */
function dominantIncomeOrder(data: PlayerData, events: Event[], preserveBowl2: boolean): Event[] | undefined {
  if (data.brainstone) return undefined;

  const powerTypes = [Resource.GainToken, Resource.ChargePower];
  const independentResources = [Resource.Credit, Resource.Ore, Resource.Knowledge, Resource.Qic, Resource.VictoryPoint];
  const groups: { reward: Reward; events: Event[] }[] = [];
  for (const event of events) {
    const powerRewards = event.rewards.filter((reward) => powerTypes.includes(reward.type));
    // Do not infer ordering for compound power effects or rewards which can trigger other choices.
    if (
      powerRewards.length !== 1 ||
      event.rewards.some(
        (reward) =>
          reward.count <= 0 || (!powerTypes.includes(reward.type) && !independentResources.includes(reward.type))
      )
    ) {
      return undefined;
    }
    const reward = powerRewards[0];
    const group = groups.find((group) => group.reward.type === reward.type && group.reward.count === reward.count);
    if (group) group.events.push(event);
    else groups.push({ reward, events: [event] });
  }

  // Income sources are indivisible. Consider interleaved sources too, merging equivalent states
  // and identical power effects instead of enumerating every permutation of the income icons.
  const used = groups.map(() => 0);
  const order: Event[] = [];
  const visited = new Set<string>();
  let best: { power: Power; charge: number; events: Event[] };
  let maxArea3 = 0;
  let maxArea2 = 0;
  const visit = (power: Power) => {
    const key = [...used, power.area1, power.area2, power.area3].join(",");
    if (visited.has(key)) return;
    visited.add(key);
    if (order.length === events.length) {
      const charge = power.area2 + 2 * power.area3;
      maxArea3 = Math.max(maxArea3, power.area3);
      maxArea2 = Math.max(maxArea2, power.area2);
      if (!best || charge > best.charge || (charge === best.charge && power.area3 > best.power.area3)) {
        best = { power, charge, events: order.slice() };
      }
      return;
    }
    groups.forEach((group, i) => {
      if (used[i] === group.events.length) return;
      const next = new Power(power.area1, power.area2, power.area3);
      if (group.reward.type === Resource.GainToken) {
        next.area1 += group.reward.count;
      } else {
        const from1 = Math.min(next.area1, group.reward.count);
        const from2 = Math.min(next.area2 + from1, group.reward.count - from1);
        next.area1 -= from1;
        next.area2 += from1 - from2;
        next.area3 += from2;
      }
      order.push(group.events[used[i]++]);
      visit(next);
      used[i]--;
      order.pop();
    });
  };
  visit(data.power);

  // More usable power must never come at the expense of charge. Itars also need to retain
  // tokens in bowl II: burning them moves the discarded token into their Gaia area.
  return best.power.area3 === maxArea3 && (!preserveBowl2 || best.power.area2 === maxArea2) ? best.events : undefined;
}

function descriptions(gainTokens: Event[], chargePowers: Event[]): Reward[] {
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

  let maxCharge: { waste: number; power: Power; events: Event[] };
  for (const s of possibleSequences.filter((value) => value.waste === minWaste)) {
    if (!maxCharge || s.power.area3 > maxCharge.power.area3) {
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
export function applyChargePowers(data: PlayerData, chargePowers: Event[]): number {
  let waste = 0;
  for (const e of chargePowers) {
    for (const reward of e.rewards) {
      if (reward.type === Resource.ChargePower) {
        const power = reward.count;
        const charged = data.chargePower(power);
        waste += power - charged;
      }
    }
  }
  return waste;
}
