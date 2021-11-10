import { AvailableSetupOption, Booster, Command, Event, SetupType, TechTile, tiles } from "@gaia-project/engine";
import { ButtonData } from "../../data";
import { eventDesc } from "../../data/event";
import { federationData } from "../../data/federations";
import { roundScoringNames } from "../../data/round-scorings";
import { finalScoringSources } from "../charts/final-scoring";
import { symbolButton, textButton } from "../commands";

function chooseTechButton(command: string, data: AvailableSetupOption, label: string) {
  const button = textButton({
    command,
    label,
    buttons: data.options.map((tile) =>
      symbolButton({
        command: tile,
        tech: { tile: tile as TechTile, commandOverride: tile },
      })
    ),
  });
  button.buttons[0].onCreate = (controller) => controller.subscribeButtonClick("techClick");
  return button;
}

export function setupButton(data: AvailableSetupOption): ButtonData {
  const command = `${Command.Setup} ${data.type} ${data.position} to`;
  switch (data.type) {
    case SetupType.Booster:
      return textButton({
        command,
        label: `Choose Booster ${data.position}`,
        buttons: data.options.map((booster) =>
          symbolButton({
            command: booster,
            booster: booster as Booster,
            label: tiles.boosters[booster].map((spec) => eventDesc(new Event(spec))).join("\n"),
          })
        ),
      });
    case SetupType.TechTile:
      return chooseTechButton(command, data, `Choose Tech Tile for Position ${data.position}`);
    case SetupType.AdvTechTile:
      return chooseTechButton(command, data, `Choose Advanced Tech Tile for Position ${data.position}`);
    case SetupType.TerraformingFederation:
      return textButton({
        command,
        label: "Choose Terraforming Federation",
        buttons: data.options.map((fed) =>
          textButton({
            command: fed,
            label: tiles.federations[fed],
            shortcuts: [federationData[fed].shortcut],
          })
        ),
      });
    case SetupType.RoundScoringTile:
      return textButton({
        command,
        label: `Choose Round Scoring ${data.position}`,
        buttons: data.options.map((scoring) =>
          textButton({
            command: scoring,
            label: roundScoringNames[scoring],
          })
        ),
      });
    case SetupType.FinalScoringTile:
      return textButton({
        command,
        label: `Choose Final Scoring ${data.position}`,
        buttons: data.options.map((scoring) =>
          textButton({
            command: scoring,
            label: finalScoringSources[scoring].name,
          })
        ),
      });
    case SetupType.MapTile:
      return textButton({
        command,
        label: `Choose Map Tile ${data.position} - starting from (left) center, then clockwise from 11 o'clock, you can rotate later`,
        buttons: data.options.map((tile) =>
          textButton({
            command: tile,
          })
        ),
      });
  }
}
