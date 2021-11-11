import Engine, { AvailableCommand, Command, Player } from "@gaia-project/engine";
import { ButtonData } from "../../data";
import { boardActionsButton, specialActionsButton } from "./actions";
import { AutoClickStrategy, checkAutoClick } from "./autoClick";
import { buildButtons, moveShipButton } from "./buildings";
import { fastConversionClick, freeAndBurnButton } from "./conversion";
import { deadEndButton } from "./dead-end";
import { declineButton } from "./decline";
import { federationButton, federationTypeButtons } from "./federation";
import { endTurnButton, passButton } from "./pass";
import { brainstoneButtons, chargePowerButtons } from "./power";
import { researchButtons, techTiles } from "./research";
import { sectorRotationButton, setupButton } from "./setup";
import { finalizeShortcuts } from "./shortcuts";
import { AvailableConversions, CommandController } from "./types";
import { autoClickButton, hexMap } from "./utils";

function commandButton(
  command: AvailableCommand,
  engine: Engine,
  player: Player,
  commands: AvailableCommand[],
  conversions: AvailableConversions,
  controller: CommandController
): ButtonData[] {
  switch (command.name) {
    case Command.RotateSectors:
      return [sectorRotationButton(controller)];

    case Command.Setup:
      return [setupButton(command.data, controller, engine)];

    case Command.Build:
      return buildButtons(controller, engine, command);

    case Command.MoveShip:
      return [moveShipButton(controller, engine, command)];

    case Command.PISwap:
      return [
        {
          label: "Swap Planetary Institute",
          shortcuts: ["w"],
          command: command.name,
          hexes: hexMap(engine, command.data.buildings, false),
        },
      ];

    case Command.PlaceLostPlanet:
      return [
        {
          label: "Place Lost Planet",
          command: command.name,
          hexes: hexMap(engine, command.data.spaces, true),
        },
      ];

    case Command.Pass:
    case Command.ChooseRoundBooster:
      return [passButton(controller, engine, player, command)];

    case Command.UpgradeResearch:
      return researchButtons(command.data.tracks, controller, player);

    case Command.ChooseTechTile:
      return [techTiles(controller, command.name, "Pick tech tile", command.data.tiles)];

    case Command.ChooseCoverTechTile:
      return [techTiles(controller, command.name, "Pick tech tile to cover", command.data.tiles)];

    case Command.ChargePower:
      return chargePowerButtons(command, engine, player);

    case Command.Decline:
      return [declineButton(command)];

    case Command.BrainStone:
      return brainstoneButtons(command.data);

    case Command.Spend: {
      conversions.free = command.data;
      return [];
    }

    case Command.BurnPower: {
      conversions.burn = command.data;
      return [];
    }

    case Command.Action:
      return [boardActionsButton(command.data, player)];

    case Command.Special:
      return [specialActionsButton(command, player)];

    case Command.EndTurn:
      return [endTurnButton(command, player)];

    case Command.DeadEnd:
      return [deadEndButton(command, controller.undo)];

    case Command.ChooseIncome:
      return command.data.map((income) => ({
        label: `Income ${income}`,
        command: `${Command.ChooseIncome} ${income}`,
      }));

    case Command.Bid:
      return command.data.bids.map((pos) => ({
        label: `Bid ${pos.bid[0]} for ${pos.faction}`,
        command: `${Command.Bid} ${pos.faction} $times`,
        times: pos.bid,
      }));

    case Command.FormFederation:
      return [federationButton(command, engine, controller, player)];

    case Command.ChooseFederationTile:
      return [
        autoClickButton({
          label: "Re-score federation",
          command: Command.ChooseFederationTile,
          buttons: federationTypeButtons(command.data.tiles, player),
        }),
      ];
  }
}

export function commandButtons(
  commands: AvailableCommand[],
  engine: Engine,
  player: Player,
  controller: CommandController,
  autoClickStrategy: AutoClickStrategy
) {
  const conversions: AvailableConversions = {};
  const ret: ButtonData[] = [];

  for (const command of commands.filter((c) => c.name != Command.ChooseFaction)) {
    ret.push(...commandButton(command, engine, player, commands, conversions, controller));
  }

  if (conversions.free || conversions.burn) {
    controller.subscriptions[Command.Spend]?.();
    controller.subscriptions[Command.Spend] = controller.subscribeAction(({ type, payload }) => {
      if (type === "fastConversionClick") {
        const command = fastConversionClick(payload, conversions, player);
        if (command) {
          controller.handleCommand(command);
        }
      }
    });

    const pass = ret.pop();
    const d = freeAndBurnButton(conversions, player);
    ret.push(d.button);
    if (pass) {
      ret.push(pass);
    }

    controller.setFastConversionTooltips(d.tooltips);
    // tooltips may have become unavailable - and they should be hidden
    controller.disableTooltips();
  }

  const decline = ret.find((b) => b.command?.startsWith(Command.Decline) ?? false);
  const withChildren = ret.filter((b) => b.buttons?.length > 0);
  if (decline && withChildren.length == 1) {
    ret.splice(ret.indexOf(decline), 1);
    withChildren[0].buttons.push(decline);
  }

  if (controller.customButtons.length > 0) {
    for (const button of ret) {
      button.hide = true;
    }

    ret.push(...controller.customButtons);
  }

  finalizeShortcuts(ret);
  checkAutoClick(controller, ret, autoClickStrategy);

  return ret;
}
