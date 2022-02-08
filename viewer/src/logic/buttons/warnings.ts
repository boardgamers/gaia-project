import { applyChargePowers, Event, Player, Resource, Reward } from "@gaia-project/engine";
import { ButtonWarning, WarningWithKey } from "../../data";
import { moveWarnings, WarningKey } from "../../data/warnings";
import { CommandController } from "./types";

export function buttonWarnings(messages: WarningWithKey[]): ButtonWarning | null {
  return messages.length > 0 && { title: "Are you sure?", body: messages };
}

export function translateWarnings(keys: string[] = []): WarningWithKey[] {
  return keys.map((disableKey) => ({
    disableKey,
    message: moveWarnings[disableKey].text,
  }));
}

export function rewardWarnings(player: Player, rewards: Reward[]): WarningWithKey[] {
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
      return [{ disableKey: WarningKey.resourceWaste, message: `${waste}${r.type} will be wasted.` }];
    }
    return [];
  });
}

export function passWarningButton(warnings: WarningWithKey[]): ButtonWarning {
  return { title: "Are you sure you want to pass?", body: warnings };
}

export function chargeIncomeWarning(player: Player, additionalEvents: Event[]) {
  const incomeSelection = player.incomeSelection(additionalEvents);
  if (incomeSelection.remainingChargesAfterIncome < 0) {
    return passWarningButton([
      {
        disableKey: WarningKey.resourceWaste,
        message: `${-incomeSelection.remainingChargesAfterIncome} power charges will be wasted during income phase.`,
      },
    ]);
  }
  return null;
}

export function resourceWasteWarning(player: Player, rewards: Reward[]): ButtonWarning | null {
  const warnings = rewardWarnings(player, rewards);
  return warnings.length == 0 ? null : { title: "Resources will be wasted - are you sure?", body: warnings };
}

export function commonButtonWarning(
  controller: CommandController,
  subject: string,
  warnings: WarningWithKey[][]
): ButtonWarning | null {
  const enabled = warnings.map((list) => list.filter((w) => controller.isWarningEnabled(w.disableKey)));
  if (enabled.length > 0 && enabled.every((b) => b?.length > 0)) {
    const common = enabled[0].filter((w) => enabled.every((b) => b.map((c) => c.message).includes(w.message)));
    return {
      title: `Every possible ${subject} has a warning`,
      body: common.length > 0 ? common : [{ disableKey: WarningKey.cannotBeDisabled, message: "Different warnings." }],
    } as ButtonWarning;
  }
  return null;
}
