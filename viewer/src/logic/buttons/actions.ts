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
import { ButtonData, ButtonWarning } from "../../data";
import { boardActionData } from "../../data/actions";
import { resourceData, translateResources } from "../../data/resources";
import { conversionButton } from "./conversion";
import { CommandController } from "./types";
import { symbolButton } from "./utils";
import { resourceWasteWarning, rewardWarnings } from "./warnings";

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
  return {
    label: "Power/Q.I.C Action",
    shortcuts: ["q"],
    command: Command.Action,
    onClick: (button) => {
      controller.highlightBoardActions(data.poweracts.map((act) => act.name));
      controller.subscribeFinal("boardActionClick", button);
    },
    buttons: data.poweracts.map((act) => boardActionButton(act.name, player)),
  };
}

function specialActionWarning(player: Player, income: string): ButtonWarning | null {
  return resourceWasteWarning(rewardWarnings(player, [new Reward(income)]));
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
  return {
    label: "Special Action",
    shortcuts: ["s"],
    command: Command.Special,
    onClick: (button) => {
      controller.highlightSpecialActions(command.data.specialacts.map((act) => act.income));
      controller.subscribeFinal("specialActionClick", button);
    },
    buttons: command.data.specialacts.map((act) => specialActionButton(act.income, player)),
  };
}
