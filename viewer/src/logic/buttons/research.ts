import {
  AvailableResearchTrack,
  ChooseTechTile,
  Command,
  Event,
  Expansion,
  Operator,
  Phase,
  Player,
  Reward,
} from "@gaia-project/engine";
import { researchEvents } from "@gaia-project/engine/src/research-tracks";
import { techTileEvents } from "@gaia-project/engine/src/tiles/techs";
import { ButtonData, ButtonWarning } from "../../data";
import { eventDesc } from "../../data/event";
import { researchData } from "../../data/research";
import { techTileData } from "../../data/tech-tiles";
import { CommandController } from "./types";
import { autoClickButton, confirmationButton, symbolButton, textButton } from "./utils";
import { resourceWasteWarning } from "./warnings";

function onceEventRewards(events: Event[], player: Player): Reward[] {
  return events.filter((e) => e.operator == Operator.Once).flatMap((e) => player.eventConditionRewards(e));
}

function advanceResearchWarning(
  player: Player,
  track: AvailableResearchTrack,
  expansion: Expansion
): ButtonWarning | null {
  let rewards = onceEventRewards(researchEvents(track.field, track.to, expansion), player);
  if (track.cost) {
    rewards = Reward.merge(rewards, Reward.negative(Reward.parse(track.cost)));
  }
  return resourceWasteWarning(player, rewards);
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
  tiles: ChooseTechTile[],
  playerForWarning: Player | null,
  expansions: Expansion
): ButtonData {
  return autoClickButton({
    command,
    label,
    buttons: tiles.map((tile) => {
      return symbolButton({
        command: tile.pos,
        shortcuts: [techTileData(tile.tile).shortcut],
        label: eventDesc(techTileEvents(tile)[0], expansions),
        warning:
          playerForWarning != null
            ? resourceWasteWarning(playerForWarning, onceEventRewards(techTileEvents(tile), playerForWarning))
            : null,
        richText: [{ tech: { pos: tile.pos } }],
      });
    }),
    onClick: (button) => {
      controller.highlightTechs(tiles.map((tile) => tile.pos));
      controller.subscribeFinal("techClick", button);
    },
  });
}
