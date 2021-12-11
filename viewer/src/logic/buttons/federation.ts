import Engine, {
  AvailableCommand,
  AvailableFederation,
  Command,
  Faction,
  Federation,
  FederationInfo,
  GaiaHex,
  MAX_SATELLITES,
  Player,
  Reward,
  tiles,
} from "@gaia-project/engine";
import { sortBy } from "lodash";
import { ButtonData, HighlightHex, HighlightHexData } from "../../data";
import { federationData } from "../../data/federations";
import { tooltipWithShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { autoClickButton, customHexSelection, textButton } from "./utils";
import {
  buttonWarnings,
  commonButtonWarning,
  resourceWasteWarning,
  rewardWarnings,
  translateWarnings,
} from "./warnings";

type Cycler = {
  currentIndex: number;
  locationButtons: ButtonData[];
  activateButton: (button: ButtonData) => void;
};

export function federationTypeButtons(federations: Federation[], player: Player) {
  return federations.map((fed, i) => {
    const federation = tiles.federations[fed];
    return textButton({
      command: fed,
      label: `Federation ${i + 1}: ${federation}`,
      shortcuts: [federationData[fed].shortcut],
      warning: resourceWasteWarning(rewardWarnings(player, Reward.parse(federation))),
    });
  });
}

function federationButtonDetails(long: boolean, satelliteName: string, info: FederationInfo) {
  const powerValue = long ? " power value" : "";
  const satellites = long ? " " + satelliteName : "";
  const sep = long ? " / " : "/";

  return `(${info.powerValue}${powerValue}${sep}${info.newSatellites}${satellites})`;
}

function customFederationButton(controller: CommandController, fedTypeButtons: ButtonData[]) {
  return {
    label: "Custom location",
    shortcuts: ["c"],
    buttons: [
      autoClickButton({
        label: "Select planets and empty space to be included in the federation",
        buttons: [
          textButton({
            label: "End Selection",
            needConfirm: true,
            keepContext: true,
            onShow: (button) => {
              controller.subscribeHexClick(button, (hex) => {
                const highlighted = controller.getHighlightedHexes().hexes;

                if (highlighted.has(hex)) {
                  highlighted.delete(hex);
                } else {
                  highlighted.set(hex, {});
                }

                const keys: GaiaHex[] = [...highlighted.keys()];
                controller.highlightHexes(customHexSelection(new Map([...keys.map((key) => [key, {}])] as any)));
              });
              controller.highlightHexes(customHexSelection(new Map<GaiaHex, HighlightHex>()));
            },
            onClick: (button) => {
              button.command = [...controller.getHighlightedHexes().hexes.keys()]
                .map((hex) => hex.toString())
                .join(",");
              controller.emitButtonCommand(button);
            },
            buttons: fedTypeButtons,
          }),
        ],
      }),
    ],
  };
}

function federationLocationButton(
  fed: AvailableFederation,
  label: string,
  engine: Engine,
  fedTypeButtons: ButtonData[],
  canHover: boolean,
  controller: CommandController,
  cycler: Cycler
) {
  return textButton({
    command: fed.hexes,
    label: label,
    hexes: {
      hexes: new Map(
        fed.hexes.split(",").map((coord) => [engine.map.getS(coord), { coordinates: coord }]) //what is 'coordinates' for?
      ) as HighlightHexData,
    },
    buttons: fedTypeButtons,
    warning: buttonWarnings(translateWarnings(fed.warnings)),
    onClick: (button) => {
      if (canHover) {
        controller.handleCommand(button.command, button);
      } else {
        cycler.activateButton(button);
      }
    },
    hover: {
      enter: (button) => {
        controller.highlightHexes(button.hexes);
      },
      leave: () => {
        controller.highlightHexes(null);
        controller.disableTooltips();
      },
    },
  });
}

function cycleButtons(
  cycler: Cycler,
  controller: CommandController,
  satType: string,
  sorted: [FederationInfo, AvailableFederation][]
): ButtonData[] {
  const okButton = textButton({
    label: "OK",
    shortcuts: ["o", "Enter"],
    onClick: () => {
      const button = cycler.locationButtons[cycler.currentIndex];
      controller.handleCommand(button.command, button);
    },
  });

  cycler.activateButton = (button: ButtonData) => {
    const i = cycler.locationButtons.indexOf(button);
    okButton.label = `OK ${i + 1} ${federationButtonDetails(true, satType, sorted[i][0])}`;
    okButton.warning = button.warning;
    okButton.tooltip = tooltipWithShortcut(null, button.warning);
    if (okButton) {
      okButton.buttonController?.setButton(okButton, String(i));
      controller.activate(button);
    }
    controller.highlightHexes(button.hexes);
  };

  const cycle = (update: number) => () => {
    const n = cycler.locationButtons.length;
    cycler.currentIndex = cycler.currentIndex == null ? 0 : (((cycler.currentIndex + update) % n) + n) % n;

    cycler.activateButton(cycler.locationButtons[cycler.currentIndex]);
  };

  const ret: ButtonData[] = [];
  if (cycler.locationButtons.length > 0) {
    ret.push(
      textButton({
        label: "Previous",
        shortcuts: ["p"],
        onClick: cycle(-1),
      })
    );

    ret.push(okButton);

    ret.push(
      textButton({
        label: "Next",
        shortcuts: ["n"],
        onClick: cycle(1),
      })
    );
  }
  return ret;
}

export function federationButton(
  command: AvailableCommand<Command.FormFederation>,
  engine: Engine,
  controller: CommandController,
  player: Player
): ButtonData {
  const fedTypeButtons: ButtonData[] = federationTypeButtons(command.data.tiles, player);

  const entries: [FederationInfo, AvailableFederation][] = command.data.federations.map((fed) => [
    player.federationInfo(player.hexesForFederationLocation(fed.hexes, engine.map)),
    fed,
  ]);

  const sorted: [FederationInfo, AvailableFederation][] = sortBy(
    entries,
    (e) => 100 * e[0].powerValue + e[0].newSatellites
  );

  const satType = player.faction === Faction.Ivits ? "QICs" : "power tokens";

  const cycler: Cycler = {
    currentIndex: 0,
    locationButtons: [],
    activateButton: () => {},
  };
  const canHover = controller.supportsHover();

  const buttons = sorted.map((e, i) => {
    const label = `Location ${i + 1} ${federationButtonDetails(i == 0, satType, e[0])}`;
    return federationLocationButton(e[1], label, engine, fedTypeButtons, canHover, controller, cycler);
  });

  const commonWarnings = commonButtonWarning(
    controller,
    "federation location",
    buttons.map((b) => b.warning?.body ?? [])
  );

  cycler.locationButtons = buttons.slice();

  buttons.push(customFederationButton(controller, fedTypeButtons));
  buttons.push(...cycleButtons(cycler, controller, satType, sorted));

  return textButton({
    label: "Form federation",
    longLabel: `Form federation (${player.maxSatellites} ${satType} can be used as satellites, ${
      MAX_SATELLITES - player.data.satellites
    } satellites are left)`,
    shortcuts: ["f"],
    command: Command.FormFederation,
    buttons: buttons,
    warning: commonWarnings,
  });
}
