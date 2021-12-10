import { AvailableCommand, Command, SubPhase } from "@gaia-project/engine";
import { ButtonData } from "../../data";
import { WarningKey } from "../../data/warnings";
import { textButton } from "./utils";

export function deadEndButton(command: AvailableCommand<Command.DeadEnd>, undo: () => void): ButtonData {
  let reason = "";
  switch (command.data as SubPhase) {
    case SubPhase.ChooseTechTile:
      reason = "No tech tile left";
      break;
    case SubPhase.BuildMineOrGaiaFormer:
      reason = "Cannot build mine or gaia former";
      break;
    case SubPhase.BuildMine:
      reason = "Cannot build mine";
      break;
    case SubPhase.PISwap:
      reason = "Cannot swap planetary institute";
      break;
    case SubPhase.DowngradeLab:
      reason = "Cannot downgrade lab";
      break;
    case SubPhase.UpgradeResearch:
      reason = "Cannot upgrade research";
      break;
  }
  return textButton({
    command: Command.DeadEnd,
    label: reason,
    warning: {
      title: "Dead end reached",
      body: [
        {
          disableKey: WarningKey.cannotBeDisabled,
          message: "You've reached a required move that is not possible to execute.",
        },
      ],
      okButton: {
        label: "Undo",
        action: () => {
          undo();
        },
      },
    },
  });
}
