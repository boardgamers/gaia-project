import Engine, { AvailableCommand, Command, Player } from "@gaia-project/engine";
import { ButtonData } from "../../data";
import { AvailableConversions, CommandController } from "./types";
import { activateOnShow, finalizeShortcuts, hasPass, hexMap } from "./utils";
import { buildButtons, moveShipButton } from "./buildings";
import { endTurnButton, passButtons } from "./pass";
import { researchButtons, techTiles } from "./research";
import { brainstoneButtons, chargePowerButtons } from "./power";
import { declineButton } from "./decline";
import { boardActionsButton, specialActionsButton } from "./actions";
import { deadEndButton } from "./dead-end";
import { federationButton, federationTypeButtons } from "./federation";
import { fastConversionClick, freeAndBurnButton } from "./conversion";


function commandButton(
  command: AvailableCommand,
  engine: Engine,
  player: Player,
  commands: AvailableCommand[],
  conversions: AvailableConversions,
  controller: CommandController
): ButtonData[] {
  switch (command.name) {
    case Command.RotateSectors: {
      return [
        {
          label: "Rotate sectors",
          command: Command.RotateSectors,
          shortcuts: ["r"],
          rotation: true,
          hexes: { hexes: new Map(), backgroundLight: true, selectAnyHex: true },
        },
      ];
    }

    case Command.Build: {
      return buildButtons(engine, command);
    }

    case Command.MoveShip: {
      return [moveShipButton(engine, command, controller)];
    }

    case Command.PISwap: {
      return [
        {
          label: "Swap Planetary Institute",
          shortcuts: ["w"],
          command: command.name,
          hexes: hexMap(engine, command.data.buildings, false),
        },
      ];
    }

    case Command.PlaceLostPlanet: {
      return [
        {
          label: "Place Lost Planet",
          command: command.name,
          hexes: hexMap(engine, command.data.spaces, true),
        },
      ];
    }

    case Command.Pass:
    case Command.ChooseRoundBooster: {
      return passButtons(engine, player, command);
    }

    case Command.UpgradeResearch: {
      return researchButtons(command, player, hasPass(commands));
    }

    case Command.ChooseTechTile:
    case Command.ChooseCoverTechTile: {
      return techTiles(command.name, command.data.tiles);
    }

    case Command.ChargePower: {
      return chargePowerButtons(command, engine, player);
    }

    case Command.Decline: {
      return [declineButton(command)];
    }

    case Command.BrainStone: {
      return brainstoneButtons(command.data);
    }
    case Command.Spend: {
      conversions.free = command.data;
      return [];
    }
    case Command.BurnPower: {
      conversions.burn = command.data;
      return [];
    }
    case Command.Action: {
      return [boardActionsButton(command.data, player)];
    }

    case Command.Special: {
      return [specialActionsButton(command, player)];
    }

    case Command.EndTurn: {
      return [endTurnButton(command, player)];
    }

    case Command.DeadEnd:
      return [deadEndButton(command, controller.undo)];

    case Command.ChooseIncome: {
      return command.data.map((income) => ({
        label: `Income ${income}`,
        command: `${Command.ChooseIncome} ${income}`,
      }));
    }

    case Command.Bid: {
      return command.data.bids.map((pos) => ({
        label: `Bid ${pos.bid[0]} for ${pos.faction}`,
        command: `${Command.Bid} ${pos.faction} $times`,
        times: pos.bid,
      }));
    }

    case Command.FormFederation: {
      return [federationButton(command, engine, controller, player)];
    }

    case Command.ChooseFederationTile: {
      return federationTypeButtons(command.data.tiles, player, Command.ChooseFederationTile + " ");
    }
  }
}

export function commandButtons(
  commands: AvailableCommand[],
  engine: Engine,
  player: Player,
  controller: CommandController
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

  if (controller.customButtons.length > 0) {
    for (const button of ret) {
      button.hide = true;
    }

    ret.push(...controller.customButtons);
  }

  finalizeShortcuts(ret);

  if (ret.length == 1) {
    const button = ret[0];
    if (button.hexes && !button.hexes.selectAnyHex && !button.warning) {
      activateOnShow(button);
    }
  }

  return ret;
}
