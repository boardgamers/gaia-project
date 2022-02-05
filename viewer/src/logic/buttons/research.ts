import {
  AvailableResearchTrack,
  ChooseTechTile,
  Command,
  Expansion,
  Operator,
  Phase,
  Player,
  Reward,
} from "@gaia-project/engine";
import { researchEvents } from "@gaia-project/engine/src/research-tracks";
import { ButtonData, ButtonWarning } from "../../data";
import { researchData } from "../../data/research";
import { techTileData } from "../../data/tech-tiles";
import { CommandController } from "./types";
import { autoClickButton, confirmationButton, textButton } from "./utils";
import { resourceWasteWarning, rewardWarnings } from "./warnings";

function advanceResearchWarning(
  player: Player,
  track: AvailableResearchTrack,
  expansion: Expansion
): ButtonWarning | null {
  let rewards = researchEvents(track.field, track.to, expansion)
    .filter((e) => e.operator == Operator.Once)
    .flatMap((e) => e.rewards);
  if (track.cost) {
    rewards = Reward.merge(rewards, Reward.negative(Reward.parse(track.cost)));
  }
  return resourceWasteWarning(rewardWarnings(player, rewards));
}

export function researchButtons(
  tracks: AvailableResearchTrack[],
  controller: CommandController,
  player: Player,
  phase: Phase,
  expansions: Expansion
): ButtonData[] {
  return [
    autoClickButton({
      command: Command.UpgradeResearch,
      label: "Research",
      shortcuts: ["r"],
      buttons: tracks.map((track) => {
        const d = researchData[track.field];
        return textButton({
          command: track.field,
          label: d.name,
          shortcuts: [d.shortcut],
          warning: advanceResearchWarning(player, track, expansions),
          buttons: phase == Phase.RoundGaia ? confirmationButton("Confirm Research " + d.name) : null,
        });
      }),
      onClick: (button) => {
        controller.highlightResearchTiles(tracks.map((track) => track.field + "-" + track.to));
        controller.subscribeFinal("researchClick", button);
      },
    }),
  ];
}

export function techTiles(
  controller: CommandController,
  command: Command,
  label: string,
  tiles: ChooseTechTile[]
): ButtonData {
  return autoClickButton({
    command,
    label,
    buttons: tiles.map((tile) =>
      textButton({
        command: tile.pos,
        shortcuts: [techTileData(tile.tile).shortcut],
        richText: [{ tech: { pos: tile.pos }}],
      })
    ),
    onClick: (button) => {
      controller.highlightTechs(tiles.map((tile) => tile.pos));
      controller.subscribeFinal("techClick", button);
    },
  });
}
