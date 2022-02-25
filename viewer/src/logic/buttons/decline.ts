import { AvailableCommand, Command, Reward } from "@gaia-project/engine";
import { ButtonData } from "../../data";
import { WarningKey } from "../../data/warnings";
import { richText, RichText, richTextRewards } from "../../graphics/rich-text";
import { withShortcut } from "./shortcuts";
import { textButton } from "./utils";
import { buttonWarnings } from "./warnings";

export function declineButton(command: AvailableCommand<Command.Decline>): ButtonData {
  const offer = command.data.offers[0].offer;
  let message = undefined;
  let r: RichText = null;
  switch (offer) {
    case Command.ChooseTechTile:
      message = "Are you sure you want to decline a tech tile?";
      break;
    case Command.UpgradeResearch:
      message = "Are you sure you want to decline a free research step?";
      break;
    default:
      r = [richText(withShortcut("Decline", "d")), richTextRewards(Reward.parse(offer))];
  }
  return textButton({
    richText: r,
    label: r == null ? `Decline ${offer}` : null,
    shortcuts: ["d"],
    command: `${Command.Decline} ${offer}`,
    warning: message ? buttonWarnings([{ message, disableKey: WarningKey.declineFree }]) : null,
  });
}
