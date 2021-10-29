import Engine, {
  AvailableCommand,
  Booster,
  Command,
  Event,
  Expansion, Faction,
  Operator,
  Player, PowerArea, Resource, Reward,
  tiles,
} from "@gaia-project/engine";
import { ButtonData, ButtonWarning } from "../../data";
import { eventDesc } from "../../data/event";
import { activateOnShow, symbolButton, textButton, translateResources } from "./utils";
import { boosterNames } from "../../data/boosters";
import { chargeIncomeWarning, passWarningButton, rewardWarnings } from "./warnings";

export function endTurnWarning(player: Player): ButtonWarning | null {
  const warning = (msg: string) =>
    ({
      title: "Are you sure you want to end the turn?",
      body: [msg],
    } as ButtonWarning);

  if (player.faction == Faction.Taklons) {
    switch (player.data.brainstone) {
      case PowerArea.Area2:
        if (player.data.burnablePower() > 0) {
          return warning("Brainstone in area 2 not moved to area 3 using burn.");
        }
        break;
      case PowerArea.Area3:
        return warning("Brainstone in area 3 not used as free action.");
    }
  }
  return null;
}

function passWarning(engine: Engine, player: Player): ButtonWarning | null {
  const warnings: string[] = [];
  const endTurn = endTurnWarning(player);
  if (endTurn != null) {
    warnings.push(...endTurn.body);
  }
  if (engine.round > 0) {
    for (const e of player.events[Operator.Activate].filter((e) => !e.activated)) {
      warnings.push(`Special action is not yet used: ${translateResources(e.rewards)}.`);
    }

    switch (player.faction) {
      case Faction.Itars:
        const burnablePower = player.data.burnablePower();
        if (burnablePower > 0 && !engine.isLastRound) {
          warnings.push(`Power tokens in area 2 not burned: ${burnablePower}.`);
        }
        break;
      case Faction.BalTaks:
        if (player.data.hasResource(new Reward(1, Resource.GaiaFormer))) {
          warnings.push("Gaiaformers are not yet converted.");
        }
        break;
    }
  }

  return warnings.length == 0 ? null : passWarningButton(warnings);
}

export function boosterWarning(player: Player, booster: Booster): ButtonWarning | null {
  const warnings: string[] = [];

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
    warnings.push(...rewardWarning.map((w) => w.substring(0, w.length - 1) + " during income phase."));
  }

  if (warnings.length > 0) {
    return passWarningButton(warnings);
  }

  return null;
}

export function passButtons(
  engine: Engine,
  player: Player,
  command: AvailableCommand<Command.Pass | Command.ChooseRoundBooster>
): ButtonData[] {
  const ret: ButtonData[] = [];
  const buttons: ButtonData[] = [];
  const warning = passWarning(engine, player);

  Booster.values(Expansion.All).forEach((booster) => {
    if (command.data.boosters.includes(booster)) {
      buttons.push(
        symbolButton({
          label: tiles.boosters[booster].map((spec) => eventDesc(new Event(spec))).join("\n"),
          command: booster,
          booster,
          needConfirm: true,
          buttons: [
            textButton({
              command: "",
              label: `Confirm Booster ${boosterNames[booster].name}`,
              warning: boosterWarning(player, booster),
            }),
          ],
        })
      );
    }
  });

  // need a Pass confirmation if it's the last round, where Command = Pass but no Boosters
  if (command.data.boosters.length === 0) {
    ret.push(
      textButton({
        label: "Pass",
        shortcuts: ["p"],
        command: Command.Pass,
        needConfirm: true,
        buttons: [
          textButton({
            command: "",
            label: `Confirm Pass`,
          }),
        ],
        warning,
      })
    );
  } else {
    const button = textButton({
      label: command.name === Command.Pass ? "Pass" : "Pick booster",
      shortcuts: ["p"],
      command: command.name,
      buttons,
      boosters: command.data.boosters,
      warning,
    });
    ret.push(command.name === Command.ChooseRoundBooster ? activateOnShow(button) : button);
  }
  return ret;
}

export function endTurnButton(command: AvailableCommand<Command.EndTurn>, player: Player): ButtonData {
  return textButton({
    label: "End Turn",
    shortcuts: ["e"],
    command: Command.EndTurn,
    needConfirm: true,
    buttons: [
      textButton({
        command: Command.EndTurn,
        label: `Confirm End Turn`,
      }),
    ],
    warning: endTurnWarning(player),
  });
}

