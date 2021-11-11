import Engine, {
  AvailableCommand,
  AvailableFederation,
  Command,
  Faction,
  Federation,
  FederationInfo,
  GaiaHex,
  HighlightHex,
  MAX_SATELLITES,
  Player,
  Reward,
  tiles,
} from "@gaia-project/engine";
import { sortBy } from "lodash";
import { ButtonData, HighlightHexData } from "../../data";
import { federationData } from "../../data/federations";
import { moveWarnings } from "../../data/warnings";
import { tooltipWithShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { customHexSelection, textButton } from "./utils";
import { buttonWarning, resourceWasteWarning, rewardWarnings } from "./warnings";

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

function federationButtonDetails(long: boolean, satelliteName: string, info) {
  const powerValue = long ? " power value" : "";
  const satellites = long ? " " + satelliteName : "";
  const sep = long ? " / " : "/";

  return `(${info.powerValue}${powerValue}${sep}${info.newSatellites}${satellites})`;
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

  const sat = player.faction === Faction.Ivits ? "QICs" : "power tokens";

  let index: number = null;
  const canHover = controller.supportsHover();
  let locationButtons: ButtonData[] = null;

  const okButton = textButton({
    label: "OK",
    shortcuts: ["o", "Enter"],
    onClick: () => {
      const button = locationButtons[index];
      controller.handleCommand(button.command, button); //to keep the selection
    },
  });

  function selectButton(index: number) {
    const button = locationButtons[index];
    okButton.label = `OK ${index + 1} ${federationButtonDetails(true, sat, sorted[index][0])}`;
    okButton.warning = button.warning;
    okButton.tooltip = tooltipWithShortcut(null, button.warning);
    if (okButton) {
      okButton.buttonController?.setButton(okButton, String(index));
      controller.activate(button);
    }
    controller.highlightHexes(button.hexes);
  }

  locationButtons = sorted.map((e, i) => {
    const info = e[0];
    const fed = e[1];
    return textButton({
      command: fed.hexes,
      label: `Location ${i + 1} ${federationButtonDetails(i == 0, sat, info)}`,
      hexes: {
        hexes: new Map(
          fed.hexes.split(",").map((coord) => [engine.map.getS(coord), { coordinates: coord }]) //what is 'coordinates' for?
        ) as HighlightHexData,
        // hover: true
      },
      buttons: fedTypeButtons,
      warning: buttonWarning(fed.warning != null ? moveWarnings[fed.warning].text : null),
      onClick: () => {
        const button = locationButtons[i];
        if (canHover) {
          controller.handleCommand(button.command, button); //to keep the selection
        } else {
          selectButton(i);
        }
      },
      hover: {
        enter: () => {
          controller.highlightHexes(locationButtons[i].hexes);
        },
        leave: () => {
          controller.highlightHexes(null);
          controller.disableTooltips();
        },
      },
    });
  });

  const n = locationButtons.length;

  const cycle = (update: number) => () => {
    index = index == null ? 0 : (((index + update) % n) + n) % n;

    selectButton(index);
  };

  locationButtons.push({
    label: "Custom location",
    shortcuts: ["c"],
    buttons: [
      textButton({
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
  });

  let next = () => {};
  if (n > 0) {
    locationButtons.push(
      textButton({
        label: "Previous",
        shortcuts: ["p"],
        onClick: cycle(-1),
      })
    );

    locationButtons.push(okButton);

    next = cycle(1);
    locationButtons.push(
      textButton({
        label: "Next",
        shortcuts: ["n"],
        onClick: next,
      })
    );
  }

  return textButton({
    label: "Form federation",
    longLabel: `Form federation (${player.maxSatellites} ${sat} can be used as satellites, ${
      MAX_SATELLITES - player.data.satellites
    } satellites are left)`,
    shortcuts: ["f"],
    command: Command.FormFederation,
    buttons: locationButtons,
    onClick: (button) => {
      next();
      controller.emitButtonCommand(button);
    },
  });
}
