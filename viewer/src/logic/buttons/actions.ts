import {
  AvailableBoardActionData,
  AvailableCommand,
  BoardAction,
  boardActions,
  Command,
  Event,
  Player,
  Reward,
} from "@gaia-project/engine";
import type { ButtonData, ButtonWarning } from "../../data";
import { boardActionData } from "../../data/actions";
import { resourceData, translateResources } from "../../data/resources";
import { conversionButton } from "./conversion";
import type { CommandController } from "./types";
import { symbolButton } from "./utils";
import { resourceWasteWarning } from "./warnings";

export function boardActionButton(action: BoardAction, player: Player | null) {
  const b = boardActions[action];
  const cost = Reward.parse(b.cost);
  const income = Reward.merge(Event.parse(b.income, null).flatMap((e) => e.rewards));

  const shortcut = boardActionData[action].shortcut;
  return conversionButton(cost, income, player, shortcut, ["Power Charges", "Terraforming"], action, action);
}

export function boardActionsButton(
  data: AvailableBoardActionData,
  player: Player,
  controller: CommandController
): ButtonData {
  const choices = data.poweracts.map((act) => boardActionButton(act.name, player));
  return {
    label: "Power/Q.I.C Action",
    mobileIcon: "board-actions",
    shortcuts: ["q"],
    command: Command.Action,
    onClick: (button) => {
      controller.highlightBoardActions(data.poweracts.map((act) => act.name));
      controller.subscribeFinal("boardActionClick", button);
    },
    buttons: choices,
  };
}

function specialActionWarning(player: Player, income: string): ButtonWarning | null {
  return resourceWasteWarning(player, [new Reward(income)]);
}

export function specialActionButton(income: string, player: Player | null): ButtonData {
  const rewards = Reward.parse(income);
  return symbolButton({
    label: translateResources(rewards, false),
    richText: [{ specialAction: income }],
    command: income,
    warning: player ? specialActionWarning(player, income) : null,
    shortcuts: [resourceData[rewards[0].type].shortcut],
  });
}

export function specialActionsButton(
  command: AvailableCommand<Command.Special>,
  player: Player,
  controller: CommandController
): ButtonData {
  const choices = command.data.specialacts.map((act) => specialActionButton(act.income, player));
  if (choices.length === 1) {
    return symbolButton({ ...choices[0], command: `${Command.Special} ${choices[0].command}`, shortcuts: ["s"] });
  }
  return {
    label: "Special Action",
    mobileIcon: "special-actions",
    shortcuts: ["s"],
    command: Command.Special,
    onClick: (button) => {
      controller.highlightSpecialActions(command.data.specialacts.map((act) => act.income));
      controller.subscribeFinal("specialActionClick", button);
    },
    buttons: choices,
  };
}

/** Shared public actions: preserve each engine command while exposing a single menu. */
export function combinedBoardActionsButton(
  board: ButtonData | undefined,
  ships: ButtonData,
  controller: CommandController
): ButtonData {
  const boardChoices = (board?.buttons ?? []).map((choice) => ({
    ...choice,
    command: `${Command.Action} ${choice.command}`,
  }));
  const shipChoices = (ships.buttons ?? []).map((choice) => ({
    ...choice,
    command: `${Command.SpaceshipAction} ${choice.command}`,
  }));
  return {
    label: "Power/Q.I.C / Ship Action",
    mobileIcon: "board-actions",
    shortcuts: ["q"],
    buttons: [...boardChoices, ...shipChoices],
    onClick: (button) => {
      controller.highlightBoardActions((board?.buttons ?? []).map((choice) => choice.command as BoardAction));
      button.subscription?.();
      button.subscription = controller.subscribeAction(({ type, payload }) => {
        if (type !== "boardActionClick") return;
        const choice = boardChoices.find((candidate) => candidate.command === `${Command.Action} ${payload.command}`);
        if (choice) controller.handleButtonClick(choice);
      });
      controller.emitButtonCommand(button, null, { disappear: false });
    },
  };
}
