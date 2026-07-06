import Engine, { ArtifactToken, AvailableCommand, Command, Reward, Resource, Spaceship } from "@gaia-project/engine";
import { spaceshipBoards, SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { ButtonData } from "../../data";
import { spaceshipNames } from "../../data/spaceships";
import { richText, richTextRewards } from "../../graphics/rich-text";
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
    buttons: command.data.ships.map((ship) => {
      const button = symbolButton({
        label: `${spaceshipNames[ship.ship]} (${ship.cost}${ship.charge > 0 ? `, +${ship.charge}pw` : ""})`,
        command: ship.ship,
      });
      // Cost shown as real reward icons (same language as building costs), not a plain-text
      // "(4, +2pw)" string - the label above still feeds the hover tooltip.
      //
      // A later exploration slot's power charge (ship.charge, from the 4-space charge track) is a
      // genuine *gain* alongside the cost, not just a bigger cost - the same "cost and gain shown
      // together" shape as any power/QIC special-action octagon elsewhere in the game, which always
      // signs the cost side negative (see Event.action()'s "-cost,+reward" string) so it reads
      // unambiguously against the (unsigned) gain next to it. A standalone cost with no accompanying
      // gain in the same button (charge === 0, e.g. the first exploration slot) has nothing to
      // disambiguate against, so it stays unsigned instead - matching a building's plain "2c 1o".
      button.richText = [
        richText(`${spaceshipNames[ship.ship]} (`),
        richTextRewards(
          ship.charge > 0 ? Reward.negative(Reward.parse(ship.cost)) : Reward.parse(ship.cost),
          ship.charge === 0
        ),
        ...(ship.charge > 0 ? [richText(", "), richTextRewards([new Reward(ship.charge, Resource.ChargePower)])] : []),
        richText(")"),
      ];
      return button;
    }),
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
  const button = textButton({
    label: `Examine Artifact (${command.data.cost})`,
    command: command.name,
  });
  button.richText = [
    richText("Examine Artifact ("),
    richTextRewards(Reward.parse(command.data.cost), true),
    richText(")"),
  ];
  return button;
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
