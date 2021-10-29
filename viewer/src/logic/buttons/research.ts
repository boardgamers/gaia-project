import {
  AvailableCommand,
  AvailableResearchTrack, ChooseTechTile,
  Command,
  Event,
  Operator,
  Player,
  researchTracks, Reward,
} from "@gaia-project/engine";
import { ButtonData, ButtonWarning } from "../../data";
import { textButton } from "./utils";
import { researchNames } from "../../data/research";
import { resourceWasteWarning, rewardWarnings } from "./warnings";

function advanceResearchWarning(player: Player, track: AvailableResearchTrack): ButtonWarning | null {
  const events = researchTracks[track.field][track.to].map((s) => new Event(s));

  let rewards = events.filter((e) => e.operator == Operator.Once).flatMap((e) => e.rewards);
  if (track.cost) {
    rewards = Reward.merge(rewards, Reward.negative(Reward.parse(track.cost)));
  }
  return resourceWasteWarning(rewardWarnings(player, rewards));
}

export function researchButtons(
  command: AvailableCommand<Command.UpgradeResearch>,
  player: Player,
  nested: boolean
): ButtonData[] {
  const tracks = command.data.tracks;
  const ret: ButtonData[] = tracks.map((track) =>
    textButton({
      command: `${command.name} ${track.field}`,
      label: researchNames[track.field],
      shortcuts: [track.field.substring(0, 1)],
      warning: advanceResearchWarning(player, track),
    })
  );

  ret[0].onCreate = (controller) => {
    controller.highlightResearchTiles(tracks.map((track) => track.field + "-" + track.to));

    //here we have to prepend the command again, because it comes from ResearchTile.vue, which is only the position
    controller.subscribeButtonClick(
      "researchClick",
      (button) => ({ command: `${command.name} ${button.command}` }),
      false
    );
  };

  if (nested) {
    return [
      textButton({
        label: "Research",
        shortcuts: ["r"],
        buttons: ret,
      }),
    ];
  }
  return ret;
}

export function techTiles(command: Command, tiles: ChooseTechTile[]): ButtonData[] {
  const ret: ButtonData[] = tiles.map((tile) => ({ command: `${command} ${tile.pos}`, tech: tile.pos }));

  ret[0].onCreate = (controller) => {
    controller.highlightTechs(tiles.map((tile) => tile.pos));
    //here we have to prepend the command again, because it comes from TechTile.vue, which is only the position
    controller.subscribeButtonClick("techClick", (button) => ({ command: `${command} ${button.command}` }));
  };
  return ret;
}

