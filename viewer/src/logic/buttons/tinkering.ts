import type { AvailableCommand } from "@gaia-project/engine";
import { Command } from "@gaia-project/engine";
import { TinkeringTile } from "@gaia-project/engine/src/enums";
import type { ButtonData } from "../../data";
import { autoClickButton, textButton } from "./utils";

const tinkeringTileLabels: Record<TinkeringTile, string> = {
  [TinkeringTile.Step1]: "Terraform 1 Step",
  [TinkeringTile.Power4]: "Charge 4 Power",
  [TinkeringTile.Qic1]: "Gain 1 QIC",
  [TinkeringTile.Step3]: "Terraform 3 Steps",
  [TinkeringTile.Knowledge3]: "Gain 3 Knowledge",
  [TinkeringTile.Qic2]: "Gain 2 QIC",
};

export function chooseTinkeringTileButton(command: AvailableCommand<Command.ChooseTinkeringTile>): ButtonData {
  return autoClickButton({
    label: "Choose Tinkering Tile",
    command: command.name,
    buttons: command.data.tiles.map((tile) =>
      textButton({
        command: tile,
        label: tinkeringTileLabels[tile],
      })
    ),
  });
}
