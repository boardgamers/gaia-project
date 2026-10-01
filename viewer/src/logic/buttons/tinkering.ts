import type { AvailableCommand } from "@gaia-project/engine";
import { Command } from "@gaia-project/engine";
import { tinkeringTileSpec } from "@gaia-project/engine/src/factions";
import type { ButtonData } from "../../data";
import { specialActionButton } from "./actions";
import { autoClickButton } from "./utils";

export function chooseTinkeringTileButton(command: AvailableCommand<Command.ChooseTinkeringTile>): ButtonData {
  return autoClickButton({
    label: "Choose Tinkering Tile",
    command: command.name,
    buttons: command.data.tiles.map((tile) => ({
      ...specialActionButton(tinkeringTileSpec(tile), null),
      command: tile,
    })),
  });
}
