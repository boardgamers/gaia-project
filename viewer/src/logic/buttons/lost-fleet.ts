import Engine, { ArtifactToken, AvailableCommand, Command, Spaceship } from "@gaia-project/engine";
import { spaceshipBoards, SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { ButtonData } from "../../data";
import { spaceshipNames } from "../../data/spaceships";
import { hexSelectionButton } from "./hex";
import { CommandController } from "./types";
import { autoClickButton, hexMap, symbolButton, textButton } from "./utils";

const artifactNames: Record<ArtifactToken, string> = {
  [ArtifactToken.KnowledgeOre]: "Knowledge + Ore",
  [ArtifactToken.Credit]: "Credit",
  [ArtifactToken.KnowledgeQic]: "Knowledge + Q.I.C.",
  [ArtifactToken.CreditLarge]: "Credit Large",
  [ArtifactToken.Power]: "Power",
  [ArtifactToken.Asteroid]: "Asteroid",
  [ArtifactToken.Protoplanet]: "Protoplanet",
  [ArtifactToken.ResearchLevel]: "Research Level",
  [ArtifactToken.ResearchTracks]: "Research Tracks",
  [ArtifactToken.Federation]: "Federation",
  [ArtifactToken.GaiaProject]: "Gaia Project",
  [ArtifactToken.PlanetTypes]: "Planet Types",
  [ArtifactToken.DeepSpace]: "Deep Space",
};

const spaceshipActionLabels: Record<SpaceshipActionType, string> = {
  qic: "Q.I.C.",
  power: "Power",
  knowledge: "Knowledge",
  credit: "Credit",
};

export function exploreButton(
  command: AvailableCommand<Command.Explore>
): ButtonData {
  return autoClickButton({
    label: "Explore",
    command: command.name,
    buttons: command.data.ships.map((ship) =>
      textButton({
        label: `${spaceshipNames[ship.ship]} (${ship.cost}${ship.charge > 0 ? `, +${ship.charge}pw` : ""})`,
        command: ship.ship,
      })
    ),
  });
}

export function spaceshipActionButton(
  command: AvailableCommand<Command.SpaceshipAction>
): ButtonData {
  return autoClickButton({
    label: "Ship Action",
    command: command.name,
    buttons: command.data.actions.map((action) => {
      const effect = spaceshipBoards[action.ship].actions.find((entry) => entry.type === action.type)?.effect ?? "";
      const button = symbolButton({
        label: `${spaceshipNames[action.ship]} ${spaceshipActionLabels[action.type]} (${action.cost})`,
        longLabel: effect ? `${spaceshipNames[action.ship]}: ${effect}` : undefined,
        richText: [{ spaceshipAction: { ship: action.ship, type: action.type } }],
        command: `${action.ship} ${action.type}`,
      });
      button.label = "<u></u>"; // icon-only - the tooltip built above from the real label still shows on hover
      return button;
    }),
  });
}

export function instantGaiaformingButton(
  controller: CommandController,
  engine: Engine,
  command: AvailableCommand<Command.GaiaFormTransdim>
): ButtonData {
  return hexSelectionButton(
    controller,
    {
      label: "Instant Gaiaforming",
      command: command.name,
      hexes: hexMap(engine, command.data.spaces, true),
    },
    undefined,
    undefined,
    undefined,
    autoClickButton
  );
}

export function placePowerRingButton(
  controller: CommandController,
  engine: Engine,
  command: AvailableCommand<Command.PlacePowerRing>
): ButtonData {
  return hexSelectionButton(
    controller,
    {
      label: "Place Power Ring",
      command: command.name,
      hexes: hexMap(engine, command.data.spaces, true),
    },
    undefined,
    undefined,
    undefined,
    autoClickButton
  );
}

export function examineArtifactButton(
  command: AvailableCommand<Command.ExamineArtifact>
): ButtonData {
  return textButton({
    label: `Examine Artifact (${command.data.cost})`,
    command: command.name,
  });
}

export function chooseArtifactTokenButton(
  command: AvailableCommand<Command.ChooseArtifactToken>
): ButtonData {
  return autoClickButton({
    label: "Choose Artifact",
    command: command.name,
    buttons: command.data.tokens.map((token) => {
      const button = symbolButton({
        label: artifactNames[token],
        longLabel: artifactTokenSpec[token],
        richText: [{ artifactToken: token }],
        command: token,
      });
      button.label = "<u></u>"; // icon-only - the tooltip built above from the real label still shows on hover
      return button;
    }),
  });
}
