import { ButtonWarning } from "../../data";
import { applyChargePowers, Event, Player, Resource, Reward } from "@gaia-project/engine";

export function buttonWarnings(messages?: string[]): ButtonWarning | null {
  return messages?.length > 0 && { title: "Are you sure?", body: messages };
}

export function buttonWarning(message?: string): ButtonWarning | null {
  return message ? buttonWarnings([message]) : null;
}

export function rewardWarnings(player: Player, rewards: Reward[]): string[] {
  const data = player.data.clone();
  return rewards.flatMap((r) => {
    let waste = 0;
    if (r.type === Resource.ChargePower) {
      waste = applyChargePowers(data, [new Event(r.toString())]);
    } else {
      data.gainRewards([r]);
      const resources = player.data.getResources(r.type);
      if (resources == 0) {
        //this resource cannot be gained
        return [];
      }
      waste = resources + r.count - data.getResources(r.type);
    }
    if (waste > 0) {
      return [`${waste}${r.type} will be wasted.`];
    }
    return [];
  });
}

export function passWarningButton(warnings: string[]): ButtonWarning {
  return { title: "Are you sure you want to pass?", body: warnings };
}

export function chargeIncomeWarning(player: Player, additionalEvents: Event[]) {
  const incomeSelection = player.incomeSelection(additionalEvents);
  if (incomeSelection.remainingChargesAfterIncome < 0) {
    return passWarningButton([
      `${-incomeSelection.remainingChargesAfterIncome} power charges will be wasted during income phase.`,
    ]);
  }
  return null;
}

export function resourceWasteWarning(warnings: string[]): ButtonWarning | null {
  return warnings.length == 0 ? null : { title: "Resources will be wasted - are you sure?", body: warnings };
}


