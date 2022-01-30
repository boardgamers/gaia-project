import Engine, { AvailableHex, GaiaHex } from "@gaia-project/engine";
import { ButtonData, ButtonWarning, HexSelection, HighlightHex, HighlightHexData } from "../../data";
import { ResourceText } from "../../graphics/utils";
import { tooltipWithShortcut, withShortcut } from "./shortcuts";

export function buttonStringLabel(button: ButtonData) {
  return (button.resourceLabel?.find((l) => typeof l == "string") as string) ?? button.label ?? button.command;
}

export function resourcesTextLabel(button: ButtonData): ResourceText {
  if (button.resourceLabel) {
    return button.resourceLabel;
  }
  const l = button.label || button.command;
  const s = button.shortcuts;
  if (l && s?.length > 0) {
    const shortcut = s[0];
    if (shortcut == "Enter" || l.includes("<u>")) {
      return [l];
    }
    return [withShortcut(l, shortcut)];
  }
  return [l];
}

export function isFree(hex: HighlightHex) {
  return hex.cost == null || hex.cost === "~";
}

export function addOnClick(button: ButtonData, action: (button: ButtonData) => void): ButtonData {
  const next = button.onClick;
  button.onClick = () => {
    next?.(button);
    action(button);
  };
  return button;
}

export function addOnShow(button: ButtonData, action: (button: ButtonData) => void) {
  const next = button.onShow;
  button.onShow = () => {
    next?.(button);
    action(button);
  };
}

export function callOnShow(button: ButtonData) {
  if (button.onShowTriggered) {
    return;
  }
  button.onShowTriggered = true;
  button.onShow?.(button);
}

export function hexMap(engine: Engine, coordinates: AvailableHex[], selectedLight: boolean): HexSelection {
  return {
    selectedLight,
    hexes: new Map<GaiaHex, HighlightHex>(
      coordinates.map((coord) => [
        engine.map.getS(coord.coordinates),
        {
          cost: coord.cost,
          warnings: coord.warnings,
        },
      ])
    ),
  };
}

export function symbolButton(button: ButtonData, skipShortcut?: string[]): ButtonData {
  button.tooltip = tooltipWithShortcut(
    button.label,
    button.warning,
    button.shortcuts ? button.shortcuts[0] : null,
    skipShortcut
  );
  return button;
}

export function textButton(button: ButtonData): ButtonData {
  button.tooltip = tooltipWithShortcut(null, button.warning);
  return button;
}

export function autoClickButton(button: ButtonData): ButtonData {
  textButton(button);
  button.smartAutoClick = true;
  return button;
}

export function confirmationButton(label: string, warning?: ButtonWarning): ButtonData[] {
  return [
    textButton({
      label,
      command: "",
      needConfirm: true,
      warning,
    }),
  ];
}

export function customHexSelection(hexes: HighlightHexData): HexSelection {
  return {
    hexes: hexes,
    selectAnyHex: true,
    backgroundLight: true,
  };
}
