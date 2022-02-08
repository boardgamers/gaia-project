import Engine, { AvailableSetupOption, Booster, Command, Federation, SetupType, TechTile } from "@gaia-project/engine";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { ButtonData } from "../../data";
import { eventDesc } from "../../data/event";
import { federationData } from "../../data/federations";
import { roundScoringData } from "../../data/round-scorings";
import { finalScoringSources } from "../charts/final-scoring";
import { CommandController } from "./types";
import { autoClickButton, symbolButton, textButton } from "./utils";

function chooseTechButton(command: string, data: AvailableSetupOption, controller: CommandController, label: string) {
  return autoClickButton({
    command,
    label,
    buttons: data.options.map((tile) =>
      symbolButton({
        command: tile,
        richText: [{ tech: { tile: tile as TechTile, commandOverride: tile } }],
      })
    ),
    onClick: (button) => {
      controller.subscribeFinal("techClick", button);
    },
  });
}

export function setupButton(data: AvailableSetupOption, controller: CommandController, engine: Engine): ButtonData {
  const command = `${Command.Setup} ${data.type} ${data.position} to`;
  switch (data.type) {
    case SetupType.Booster:
      return autoClickButton({
        command,
        label: `Choose Booster ${data.position}`,
        buttons: data.options.map((booster) =>
          symbolButton({
            command: booster,
            richText: [{ booster: booster as Booster }],
            label: boosterEvents(booster as Booster)
              .map((e) => eventDesc(e, engine.expansions))
              .join("\n"),
          })
        ),
      });
    case SetupType.TechTile:
      return chooseTechButton(command, data, controller, `Choose Tech Tile for Position ${data.position}`);
    case SetupType.AdvTechTile:
      return chooseTechButton(command, data, controller, `Choose Advanced Tech Tile for Position ${data.position}`);
    case SetupType.TerraformingFederation:
      return autoClickButton({
        command,
        label: "Choose Terraforming Federation",
        buttons: data.options.map((fed) =>
          textButton({
            command: fed,
            label: federationRewards(fed as Federation).join(","),
            shortcuts: [federationData[fed].shortcut],
          })
        ),
      });
    case SetupType.RoundScoringTile:
      return autoClickButton({
        command,
        label: `Choose Round Scoring ${data.position}`,
        buttons: data.options.map((scoring) =>
          textButton({
            command: scoring,
            label: roundScoringData[scoring].name,
          })
        ),
      });
    case SetupType.FinalScoringTile:
      return autoClickButton({
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
      return autoClickButton({
        command,
        label: `Choose Map Tile ${data.position} (for red circle)`,
        buttons: data.options.map((tile) =>
          textButton({
            command: tile,
          })
        ),
        onClick: (button) => {
          controller.highlightSectors(engine.map.configuration().centers.slice(Number(data.position) - 1));
          controller.emitButtonCommand(button);
        },
      });
  }
}

export function sectorRotationButton(controller: CommandController) {
  return {
    label: "Rotate sectors",
    command: Command.RotateSectors,
    shortcuts: ["r"],
    buttons: [
      textButton({
        label: "Sector rotations finished",
        needConfirm: true,
        keepContext: true,
        onShow: (button) => {
          controller.subscribeHexClick(button, (hex) => controller.rotate(hex));
          controller.highlightHexes({ hexes: new Map(), backgroundLight: true, selectAnyHex: true });
        },
        onClick: (button) => {
          const rotations = [...controller.getRotation().entries()];
          for (const rotation of rotations) {
            rotation[1] %= 6;
          }
          controller.emitButtonCommand(button, [].concat(...rotations.filter((r) => !!r[1])).join(" "));
        },
      }),
    ],
  };
}
