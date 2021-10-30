import { ButtonData, ButtonWarning, HexSelection, HighlightHexData } from "../../data";
import Engine, { AvailableCommand, AvailableHex, Command, GaiaHex, HighlightHex, Reward } from "@gaia-project/engine";
import { resourceNames } from "../../data/resources";
import assert from "assert";
import { MoveButtonController } from "./types";

export function addOnCreate(button: ButtonData, action: (controller: MoveButtonController) => void) {
  const next = button.onCreate;
  button.onCreate = (c) => {
    next?.(c);
    action(c);
  };
}

export function addOnClick(button: ButtonData, action: (controller: MoveButtonController) => void) {
  let controller: MoveButtonController = null;
  addOnCreate(button, (c) => {
    controller = c;
  });
  const next = button.onClick;
  button.onClick = () => {
    next?.();
    action(controller);
  };
}

export function addOnShow(button: ButtonData, onlyOnce: boolean, action: (c: MoveButtonController) => void) {
  let controller: MoveButtonController = null;
  addOnCreate(button, (c) => {
    controller = c;
  });
  const next = button.onShow;
  button.onShow = () => {
    next?.();
    if (onlyOnce) {
      if (button.onShowTriggered) {
        return;
      }
      button.onShowTriggered = true;
    }
    action(controller);
  };
}

export const forceNumericShortcut = (label: string) => ["Charge", "Income"].find((b) => label.startsWith(b));

export function prependShortcut(shortcut: string, label: string) {
  return `<u>${shortcut}</u>: ${label}`;
}

export function withShortcut(label: string | null, shortcut: string | null, skip?: string[]): string | null {
  if (!label || !shortcut || label.includes("<u>")) {
    return label;
  }

  let skipIndex = 0;
  for (const s of skip ?? []) {
    const found = label.indexOf(s);
    if (found >= 0) {
      skipIndex = found + s.length;
    }
  }

  const i = label.toLowerCase().indexOf(shortcut, skipIndex);

  if (i >= 0 && !forceNumericShortcut(label)) {
    return `${label.substring(0, i)}<u>${label.substring(i, i + 1)}</u>${label.substring(i + 1)}`;
  } else {
    return prependShortcut(shortcut, label);
  }
}

export function tooltipWithShortcut(tooltip: string | null, warn: ButtonWarning | null, shortcut?: string, skip?: string[]) {
  const warnings = warn?.body?.join(", ");

  if (tooltip && warn) {
    return withShortcut(tooltip, shortcut, skip) + " - " + warnings;
  }
  return withShortcut(tooltip, shortcut, skip) ?? warnings;
}

export function activateOnShow(button: ButtonData): ButtonData {
  button.disabled = true;
  addOnShow(button, true, (c) => c.handleClick());
  return button;
}

export function translateResources(rewards: Reward[]): string {
  return rewards
    .map((r) => {
      const s = resourceNames.find((s) => s.type == r.type);
      assert(s, "no resource name for " + r.type);
      return r.count + " " + (r.count == 1 ? s.label : s.plural);
    })
    .join(" and ");
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
  button.label = "<u></u>"; //to prevent fallback to command
  return button;
}

export function textButton(button: ButtonData): ButtonData {
  button.tooltip = tooltipWithShortcut(null, button.warning);
  return button;
}

function addSingleButtonShortcut(b: ButtonData) {
  if (b.shortcuts.includes("Enter")) {
    //already processed
    return;
  }

  const label = b.label ?? b.command;
  if (label && !label.includes("<u>")) {
    if (isFinite(Number(b.shortcuts[0]))) {
      //remove any numeric shortcuts
      b.shortcuts = [];
    }

    if (forceNumericShortcut(label)) {
      b.shortcuts.push("1");
    } else {
      b.shortcuts.push(label.substring(0, 1).toLowerCase());
    }
  }
  b.shortcuts.push("Enter");
}

export function finalizeShortcuts(buttons: ButtonData[]) {
  for (const button of buttons) {
    if (button.buttons) {
      finalizeShortcuts(button.buttons);
    }
  }
  let shortcut = 1;

  const shown = buttons.filter((b) => !b.hide);
  for (const b of shown) {
    if (b.shortcuts == undefined) {
      b.shortcuts = [];
    }
    if (b.shortcuts.length == 0) {
      const assigned = b.label?.includes("<u>") ? b.label.substr(b.label.indexOf("<u>") + 3, 1).toLowerCase() : null;

      if (assigned && assigned != "<") { //to avoid <u></u>
        b.shortcuts.push(assigned);
      } else {
        b.shortcuts.push(String(shortcut));
        shortcut++;
      }
    }
  }

  if (shown.length == 1) {
    addSingleButtonShortcut(shown[0]);
  }
}

export function customHexSelection(hexes: HighlightHexData): HexSelection {
  return {
    hexes: hexes,
    selectAnyHex: true,
    backgroundLight: true,
  };
}

export function hasPass(commands: AvailableCommand[]) {
  return commands.some((c) => c.name === Command.Pass);
}



