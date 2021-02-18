import Player from "./player";
import { IncomeSelection } from "./income";
import { Faction, Resource } from "./enums";
import { Offer } from "./available-command";
import Reward from "./reward";

export enum ChargeDecision {
  Yes,
  No,
  Ask,
  Undecided,
}

export class ChargeRequest {
  public readonly minCharge: number;
  public readonly maxCharge: number;
  public readonly maxAllowedOffer: Offer;

  constructor(
    public readonly player: Player,
    public readonly offers: Offer[],
    public readonly isLastRound: boolean,
    public readonly playerHasPassed: boolean,
    public readonly incomeSelection: IncomeSelection
  ) {
    let minCharge = 100;
    let maxCharge = 0;

    const limit = Math.max(player.settings.autoChargePower, 1);
    let allowedMax = 0;
    let maxAllowedOffer: Offer = null;

    for (const offer of this.offers) {
      const rewards = Reward.parse(offer.offer);
      for (let i = 0; i < rewards.length; i++) {
        const reward = rewards[i];

        if (reward.type == Resource.ChargePower) {
          const charge = reward.count;
          if (charge < minCharge) {
            minCharge = charge;
          }
          if (charge > maxCharge) {
            maxCharge = charge;
          }
          if (charge <= limit) {
            if (charge > allowedMax) {
              maxAllowedOffer = offer;
              allowedMax = charge;
            } else if (charge == allowedMax && i == 0) {
              //prefer to charge first if 2 offers have the same charge
              maxAllowedOffer = offer;
            }
          }
        }
      }
    }
    this.minCharge = minCharge;
    this.maxCharge = maxCharge;
    this.maxAllowedOffer = maxAllowedOffer;
  }
}

const chargeRules: ((ChargeRequest) => ChargeDecision)[] = [
  askOrDeclineForPassedPlayer,
  (r: ChargeRequest) => askForMultipleTaklonsOffers(r.offers, r.player.settings.autoBrainstone),
  (r: ChargeRequest) => askOrDeclineBasedOnCost(r.minCharge, r.maxCharge, r.player.settings.autoChargePower),
  askForItars,
  () => ChargeDecision.Yes,
];

export function decideChargeRequest(r: ChargeRequest): ChargeDecision {
  for (const chargeRule of chargeRules) {
    const decision = chargeRule(r);
    if (decision != ChargeDecision.Undecided) {
      return decision;
    }
  }
  return ChargeDecision.Undecided;
}

// A passed player should always decline a leech if there's a VP cost associated with it -
// if it's either the last round or if the income phase would already move all tokens to area3.
// If this not true, please add an example (or link to) in the comments
function askOrDeclineForPassedPlayer(r: ChargeRequest): ChargeDecision {
  const noOfferIsFree = r.offers.every((offer) => offer.cost !== "~");

  if (r.playerHasPassed && noOfferIsFree) {
    const remaining = r.incomeSelection.remainingChargesAfterIncome;
    if (r.isLastRound) {
      return ChargeDecision.No;
    } else if (remaining <= 0) {
      //all charges are wasted
      return ChargeDecision.No;
    } else if (remaining < r.minCharge) {
      //some charges are wasted
      return ChargeDecision.Ask;
    }
  }
  return ChargeDecision.Undecided;
}

function askForMultipleTaklonsOffers(offers: Offer[], autoBrainstone: boolean): ChargeDecision {
  if (offers.length == 2 && autoBrainstone) {
    //may still decline based on cost
    return ChargeDecision.Undecided;
  }
  if (offers.length > 1) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

export function askOrDeclineBasedOnCost(minCharge: number, maxCharge: number, autoChargePower: number) {
  if (autoChargePower == 0) {
    // 0 means we decline if it's not free
    if (minCharge > 1) {
      return ChargeDecision.No;
    }
    return ChargeDecision.Undecided;
  }

  if (maxCharge > autoChargePower) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

function askForItars(r: ChargeRequest): ChargeDecision {
  // Itars may want to burn power instead, but we can safely move to area2
  if (
    r.player.faction === Faction.Itars &&
    !r.player.settings.itarsAutoChargeToArea3 &&
    !autoChargeItars(r.player.data.power.area1, r.minCharge) &&
    !this.isLastRound
  ) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

export function autoChargeItars(area1: number, power: number) {
  return area1 >= power;
}
