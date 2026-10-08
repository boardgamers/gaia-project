import Engine, { ArtifactToken, AvailableCommand, Command, Resource, Reward, Spaceship } from "@gaia-project/engine";
import type { SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import { spaceshipBoards } from "@gaia-project/engine/src/spaceships";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import type { ButtonData } from "../../data";
import { instantGaiaformingEffect } from "../../data/event";
import { spaceshipNames } from "../../data/spaceships";
import type { RichTextElement } from "../../graphics/rich-text";
import { richText, richTextRewards } from "../../graphics/rich-text";
import { hexSelectionButton } from "./hex";
import { tooltipWithShortcut } from "./shortcuts";
import type { CommandController } from "./types";
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

export function exploreButton(command: AvailableCommand<Command.Explore>): ButtonData {
  return autoClickButton({
    label: "Explore",
    mobileIcon: "explore",
    command: command.name,
    buttons: command.data.ships.map((ship) => {
      const button = symbolButton({
        label: `${spaceshipNames[ship.ship]} (${ship.cost}${ship.charge > 0 ? `, +${ship.charge}pw` : ""})`,
        command: ship.ship,
      });
      // Cost shown as real reward icons (same language as building costs), not a plain-text
      // "(4, +2pw)" string - the label above still feeds the hover tooltip.
      //
      // Always a plain, unsigned number - same convention as every other standalone cost (a
      // building's "2c 1o", Examine Artifact's token cost) - even for a later exploration slot
      // whose power charge is a genuine gain alongside the cost. An earlier attempt signed the cost
      // negative only when a charge was gained alongside it (matching special-action octagons'
      // "-cost,+reward"), but with several ships to choose from in the same list - some gaining a
      // charge, some not - that made the sign inconsistent from one button to the next, which read
      // as more confusing than helpful. Reverted to unsigned for every case.
      button.richText = [
        richText(`${spaceshipNames[ship.ship]} (`),
        richTextRewards(Reward.parse(ship.cost), true),
        ...(ship.charge > 0 ? [richText(", "), richTextRewards([new Reward(ship.charge, Resource.ChargePower)])] : []),
        richText(")"),
      ];
      return button;
    }),
  });
}

export function spaceshipActionButton(command: AvailableCommand<Command.SpaceshipAction>): ButtonData {
  return autoClickButton({
    label: "Ship Action",
    mobileIcon: "ship-action",
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
      mobileIcon: "instant-gaiaforming",
      command: command.name,
      // `selectedLight: false` on purpose - a "light" selection is only `opacity: .7` over the
      // hex's normal dark fill (SpaceHex.vue), which is invisible as a highlight. The targets of
      // this action are transdim planets already in range, so their cost is "~" (free) and they
      // fall straight through to that style, leaving the map looking untouched while the button
      // list offered coordinates to pick from. `false` gives them the same white `bold` fill that
      // Build/Upgrade targets get, which is what the map is expected to do for a hex choice.
      hexes: hexMap(engine, command.data.spaces, false),
    },
    undefined,
    undefined,
    undefined,
    autoClickButton
  );
}

/**
 * Instant Gaiaforming offered from the Gaia Former menu, for each source that can do it this turn:
 * the round booster's special action and T F Mars's Power action. Players who own one tend to start
 * a normal Gaia Project instead (moving power tokens to the Gaia area) and expect the action to
 * finish it, but the action places the Gaia Former itself. Each choice is the same move as taking
 * the action from its usual menu, which then asks for the Transdim planet.
 */
export function instantGaiaformingChoices(commands: AvailableCommand[]): ButtonData[] {
  const sources: { label: string; command: string; icon: RichTextElement }[] = [];

  const special = commands.find((c) => c.name === Command.Special) as AvailableCommand<Command.Special> | undefined;
  if (special?.data.specialacts.some((act) => act.income === Resource.InstantGaiaforming)) {
    sources.push({
      label: "Instant Gaiaforming (booster)",
      command: `${Command.Special} ${Resource.InstantGaiaforming}`,
      icon: { specialAction: Resource.InstantGaiaforming },
    });
  }

  const ships = commands.find((c) => c.name === Command.SpaceshipAction) as
    AvailableCommand<Command.SpaceshipAction> | undefined;
  const tfMars = ships?.data.actions.find((action) => action.ship === Spaceship.TFMars && action.type === "power");
  if (tfMars) {
    sources.push({
      label: `Instant Gaiaforming (${spaceshipNames[tfMars.ship]}, ${tfMars.cost})`,
      command: `${Command.SpaceshipAction} ${tfMars.ship} ${tfMars.type}`,
      icon: { spaceshipAction: { ship: tfMars.ship, type: tfMars.type } },
    });
  }

  // Letters, because the hex choices next to these already take the number keys.
  const shortcuts = ["g", "i"];
  return sources.map((source, i) => ({
    label: source.label,
    // Icon only, like the special action itself - the tooltip carries the name and the shortcut.
    richText: [source.icon],
    command: source.command,
    shortcuts: [shortcuts[i]],
    tooltip: tooltipWithShortcut(`${source.label}: ${instantGaiaformingEffect}`, null, shortcuts[i]),
  }));
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
      mobileIcon: "power-ring",
      command: command.name,
      // Same reason as Instant Gaiaforming above, and unconditional here: power-ring targets are
      // the player's own built planets and carry no cost at all, so a "light" selection never
      // showed anything on the map.
      hexes: hexMap(engine, command.data.spaces, false),
    },
    undefined,
    undefined,
    undefined,
    autoClickButton
  );
}

export function examineArtifactButton(command: AvailableCommand<Command.ExamineArtifact>): ButtonData {
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

export function chooseArtifactTokenButton(command: AvailableCommand<Command.ChooseArtifactToken>): ButtonData {
  return autoClickButton({
    label: "Choose Artifact",
    mobileIcon: "artifact",
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
