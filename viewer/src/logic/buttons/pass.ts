import Engine, {
  AvailableCommand,
  Booster,
  Command,
  Event,
  Faction,
  Operator,
  Player,
  PowerArea,
  Resource,
  Reward,
  tiles,
} from "@gaia-project/engine";
import { ButtonData, ButtonWarning, WarningWithKey } from "../../data";
import { boosterNames } from "../../data/boosters";
import { WarningKey } from "../../data/warnings";
import { CommandController } from "./types";
import { autoClickButton, confirmationButton, symbolButton, textButton, translateResources } from "./utils";
import { chargeIncomeWarning, passWarningButton, rewardWarnings } from "./warnings";

export function endTurnWarning(player: Player): ButtonWarning | null {
  const warning = (disableKey: WarningKey, message: string) =>
    ({
      title: "Are you sure you want to end the turn?",
      body: [{ disableKey, message }],
    } as ButtonWarning);

  if (player.faction == Faction.Taklons) {
    switch (player.data.brainstone) {
      case PowerArea.Area2:
        if (player.data.burnablePower() > 0) {
          return warning(WarningKey.taklonsNotBurned, "Brainstone in area 2 not moved to area 3 using burn.");
        }
        break;
      case PowerArea.Area3:
        return warning(WarningKey.taklonsBrainstoneArea3, "Brainstone in area 3 not used as free action.");
    }
  }
  return null;
}

function passWarning(engine: Engine, player: Player): ButtonWarning | null {
  const warnings: WarningWithKey[] = [];
  const endTurn = endTurnWarning(player);
  if (endTurn != null) {
    warnings.push(...endTurn.body);
  }
  if (engine.round > 0) {
    for (const e of player.events[Operator.Activate].filter((e) => !e.activated)) {
      warnings.push({
        disableKey: WarningKey.actionNotUsed,
        message: `Special action is not yet used: ${translateResources(e.rewards)}.`,
      });
    }

    switch (player.faction) {
      case Faction.Itars:
        const burnablePower = player.data.burnablePower();
        if (burnablePower > 0 && !engine.isLastRound) {
          warnings.push({
            disableKey: WarningKey.itarsNotBurned,
            message: `Power tokens in area 2 not burned: ${burnablePower}.`,
          });
        }
        break;
      case Faction.BalTaks:
        if (player.data.hasResource(new Reward(1, Resource.GaiaFormer))) {
          warnings.push({ disableKey: WarningKey.actionNotUsed, message: "Gaiaformers are not yet converted." });
        }
        break;
    }
  }

  return warnings.length == 0 ? null : passWarningButton(warnings);
}

export function boosterWarning(player: Player, booster: Booster): ButtonWarning | null {
  const warnings: WarningWithKey[] = [];

  const additionalEvents = tiles.boosters[booster].map((spec) => new Event(spec));

  const charge = chargeIncomeWarning(player, additionalEvents);
  if (charge) {
    warnings.push(...charge.body);
  }

  const incomeEvents = player.events[Operator.Income];
  const notActivated = incomeEvents.filter((ev) => !ev.activated);
  if (additionalEvents) {
    notActivated.push(...additionalEvents);
  }
  const rewards = Reward.merge(...notActivated.map((e) => e.rewards)).filter((r) => r.type != Resource.ChargePower);

  const rewardWarning = rewardWarnings(player, rewards);
  if (rewardWarning?.length > 0) {
    warnings.push(
      ...rewardWarning
        .map((w) => w.message.substring(0, w.message.length - 1) + " during income phase.")
        .map((message) => ({
          disableKey: WarningKey.resourceWaste,
          message,
        }))
    );
  }

  if (warnings.length > 0) {
    return passWarningButton(warnings);
  }

  return null;
}

export function passButton(
  controller: CommandController,
  engine: Engine,
  player: Player,
  command: AvailableCommand<Command.Pass | Command.ChooseRoundBooster>
): ButtonData {
  const warning = passWarning(engine, player);

  // need a Pass confirmation if it's the last round, where Command = Pass but no Boosters
  if (command.data.boosters.length === 0) {
    return textButton({
      label: "Pass",
      shortcuts: ["p"],
      command: Command.Pass,
      buttons: confirmationButton("Confirm Pass"),
      warning,
    });
  }

  return autoClickButton({
    label: command.name === Command.Pass ? "Pass" : "Pick booster",
    shortcuts: ["p"],
    command: command.name,
    buttons: command.data.boosters.map((booster) => {
      const label = boosterNames[booster].name;
      return symbolButton({
        label,
        command: booster,
        booster,
        buttons: confirmationButton(`Confirm Booster ${label}`, boosterWarning(player, booster)),
      });
    }),
    warning,
  });
}

export function endTurnButton(command: AvailableCommand<Command.EndTurn>, player: Player): ButtonData {
  return textButton({
    label: "End Turn",
    shortcuts: ["e"],
    command: Command.EndTurn,
    buttons: confirmationButton("Confirm End Turn"),
    warning: endTurnWarning(player),
  });
}
