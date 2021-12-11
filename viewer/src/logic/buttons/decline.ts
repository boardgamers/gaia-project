import { AvailableCommand, Command } from "@gaia-project/engine";
import { ButtonData } from "../../data";
import { WarningKey } from "../../data/warnings";
import { textButton } from "./utils";
import { buttonWarnings } from "./warnings";

export function declineButton(command: AvailableCommand<Command.Decline>): ButtonData {
  const offer = command.data.offers[0].offer;
  let message = undefined;
  switch (offer) {
    case Command.ChooseTechTile:
      message = "Are you sure you want to decline a tech tile?";
      break;
    case Command.UpgradeResearch:
      message = "Are you sure you want to decline a free research step?";
      break;
  }
  return textButton({
    label: `Decline ${offer}`,
    shortcuts: ["d"],
    command: `${Command.Decline} ${offer}`,
    warning: message ? buttonWarnings([{ message, disableKey: WarningKey.declineFree }]) : null,
  });
}
