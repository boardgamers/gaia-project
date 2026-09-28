import Engine, {
  ArtifactToken,
  AvailableSetupOption,
  Booster,
  Command,
  Federation,
  Planet,
  ScoringBoardExtensionSide,
  SetupType,
  SpaceshipFederation,
  TechTile,
} from "@gaia-project/engine";
import { LostFleetEconomySide } from "@gaia-project/engine/src/enums";
import {
  findDeepSpaceNotches,
  findInterspaceHoles,
  lostFleetSectorCenters,
} from "@gaia-project/engine/src/lost-fleet-map";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import type { ButtonData } from "../../data";
import { eventDesc } from "../../data/event";
import { federationData } from "../../data/federations";
import { planetNames } from "../../data/planets";
import { roundScoringData } from "../../data/round-scorings";
import { spaceshipDisplayNames } from "../../data/spaceships";
import { finalScoringSources } from "../charts/final-scoring";
import type { CommandController } from "./types";
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
    case SetupType.SpaceshipTechTile:
      return chooseTechButton(
        command,
        data,
        controller,
        `Choose Tech Tile for ${spaceshipDisplayNames[data.position]}`
      );
    case SetupType.SpaceshipFederation:
      return autoClickButton({
        command,
        label: `Choose Federation Token for ${spaceshipDisplayNames[data.position]}`,
        buttons: data.options.map((tile) =>
          symbolButton({
            command: tile,
            richText: [{ spaceshipFederation: tile as SpaceshipFederation }],
          })
        ),
      });
    case SetupType.ArtifactToken:
      return autoClickButton({
        command,
        label: `Choose Artifact ${data.position} for Twilight`,
        buttons: data.options.map((tile) =>
          symbolButton({
            command: tile,
            richText: [{ artifactToken: tile as ArtifactToken }],
          })
        ),
      });
    case SetupType.ScoringExtensionSide:
      return autoClickButton({
        command,
        label: "Choose Scoring Board Extension Side",
        buttons: data.options.map((side) =>
          textButton({
            command: side,
            label: side === ScoringBoardExtensionSide.VictoryPoints ? "25 VP" : "Explore 3 spaceships",
          })
        ),
      });
    case SetupType.EconomySide:
      return autoClickButton({
        command,
        label: "Choose Economy Track Side",
        buttons: data.options.map((side) =>
          textButton({
            command: side,
            label: side === LostFleetEconomySide.Power ? "Power income" : "VP income",
          })
        ),
      });
    case SetupType.TerraformingColor:
      return autoClickButton({
        command,
        label: `Choose Terraforming Row Color ${data.position}`,
        buttons: data.options.map((planet) =>
          symbolButton({
            command: planet,
            label: planetNames[planet],
            richText: [{ planet: planet as Planet }],
          })
        ),
      });
    case SetupType.InterspaceTile:
      return autoClickButton({
        command,
        label: `Choose Interspace Tile ${data.position} (for red circle)`,
        buttons: data.options.map((tile) =>
          symbolButton({
            command: tile,
            label: spaceshipDisplayNames[tile] ?? planetNames[tile] ?? "Empty space",
            richText: spaceshipDisplayNames[tile] || tile === Planet.Empty ? undefined : [{ planet: tile as Planet }],
          })
        ),
        onClick: (button) => {
          controller.highlightSectors([
            findInterspaceHoles(lostFleetSectorCenters(engine.players.length))[Number(data.position) - 1],
          ]);
          controller.emitButtonCommand(button);
        },
      });
    case SetupType.DeepSpaceTile:
      return autoClickButton({
        command,
        label: `Choose Deep Space Tile ${data.position} (for red circle)`,
        buttons: [...new Set(data.options.map((choice) => choice.slice(0, 2)))].map((id) =>
          textButton({
            command: "",
            label: `Tile ${id}`,
            keepContext: true,
            buttons: data.options
              .filter((choice) => choice.startsWith(id))
              .map((choice) =>
                symbolButton({
                  command: choice,
                  label: `${choice.slice(0, 3).toUpperCase()} · ${Number(choice[3]) * 120}°`,
                  richText: [
                    { text: `${choice.slice(0, 3).toUpperCase()} · ${Number(choice[3]) * 120}°` },
                    { deepSpaceTile: { choice, position: Number(data.position) } },
                  ],
                })
              ),
          })
        ),
        onClick: (button) => {
          controller.highlightSectors([
            findDeepSpaceNotches(lostFleetSectorCenters(engine.players.length))[Number(data.position) - 1][0],
          ]);
          controller.emitButtonCommand(button);
        },
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
