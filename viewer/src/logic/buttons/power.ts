import Engine, {
  AvailableCommand,
  BrainstoneActionData,
  Command,
  Event,
  Player,
  PowerArea,
  Reward,
} from "@gaia-project/engine";
import { ButtonData, ButtonWarning } from "../../data";
import { richText, richTextRewards } from "../../graphics/rich-text";
import { withShortcut } from "./shortcuts";
import { textButton } from "./utils";
import { buttonWarnings, chargeIncomeWarning, translateWarnings } from "./warnings";

function chargeWarning(engine: Engine, player: Player, offer: string): ButtonWarning | null {
  return engine.passedPlayers.includes(player.player) ? chargeIncomeWarning(player, [new Event(offer)]) : null;
}

export function brainstoneButtons(data: BrainstoneActionData): ButtonData[] {
  return data.choices.sort().map((d) => {
    const area = d.area;
    return textButton({
      label: `Brainstone ${area}`,
      warning: d.warning ? buttonWarnings(translateWarnings([d.warning])) : null,
      command: `${Command.BrainStone} ${area}`,
      shortcuts: [area == PowerArea.Gaia ? "g" : area.substring("area".length, area.length)],
    });
  });
}

export function chargePowerButtons(
  command: AvailableCommand<Command.ChargePower>,
  engine: Engine,
  player: Player
): ButtonData[] {
  const ret: ButtonData[] = [];

  command.data.offers.forEach((offer, index) => {
    const leech = offer.offer;
    const action = leech.includes("pw") ? "Charge" : "Gain";
    const shortcut = String(index + 1);
    ret.push(
      textButton({
        richText:
          offer.cost && offer.cost !== "~"
            ? [
                richText(withShortcut(action, shortcut)),
                richTextRewards(Reward.parse(leech)),
                richText("for"),
                richTextRewards(Reward.parse(offer.cost)),
              ]
            : [richText(withShortcut(action, shortcut)), richTextRewards(Reward.parse(leech))],
        shortcuts: [shortcut],
        command: `${Command.ChargePower} ${leech}`,
        warning: chargeWarning(engine, player, leech),
      })
    );
  });
  return ret;
}
