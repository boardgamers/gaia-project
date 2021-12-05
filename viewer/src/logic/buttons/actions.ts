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
import { boardActionNames } from "../../data/actions";
import { resourceNames } from "../../data/resources";
import { conversionButton } from "./conversion";
import { symbolButton, translateResources } from "./utils";
import { resourceWasteWarning, rewardWarnings } from "./warnings";

export function boardActionButton(action: BoardAction, player: Player | null) {
  const b = boardActions[action];
  const cost = Reward.parse(b.cost);
  const income = Reward.merge(Event.parse(b.income, null).flatMap((e) => e.rewards));

  const shortcut = boardActionNames[action].shortcut;
  return conversionButton(cost, income, player, shortcut, ["Power Charges", "Terraforming"], action, action);
}

export function boardActionsButton(data: AvailableBoardActionData, player: Player): ButtonData {
  return {
    label: "Power/Q.I.C Action",
    shortcuts: ["q"],
    command: Command.Action,
    boardActions: data.poweracts.map((act) => act.name),
    buttons: data.poweracts.map((act) => boardActionButton(act.name, player)),
  };
}

function specialActionWarning(player: Player, income: string): ButtonWarning | null {
  return resourceWasteWarning(rewardWarnings(player, [new Reward(income)]));
}

export function specialActionButton(income: string, player: Player | null): ButtonData {
  const rewards = Reward.parse(income);
  return symbolButton({
    label: translateResources(rewards),
    command: income,
    specialAction: income,
    warning: player ? specialActionWarning(player, income) : null,
    shortcuts: [resourceNames.find((r) => r.type === rewards[0].type).shortcut],
  });
}

export function specialActionsButton(command: AvailableCommand<Command.Special>, player: Player): ButtonData {
  return {
    label: "Special Action",
    shortcuts: ["s"],
    command: Command.Special,
    specialActions: command.data.specialacts.map((act) => act.income),
    buttons: command.data.specialacts.map((act) => specialActionButton(act.income, player)),
  };
}
