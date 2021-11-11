import { ButtonData, ButtonWarning } from "../../data";

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

export function tooltipWithShortcut(
  tooltip: string | null,
  warn: ButtonWarning | null,
  shortcut?: string,
  skip?: string[]
) {
  const warnings = warn?.body?.join(", ");

  if (tooltip && warn) {
    return withShortcut(tooltip, shortcut, skip) + " - " + warnings;
  }
  return withShortcut(tooltip, shortcut, skip) ?? warnings;
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

function addDefaultShortcuts(shown: ButtonData[]) {
  let shortcut = 1;
  let addNumeric = true;

  for (const b of shown) {
    if (b.shortcuts == undefined) {
      b.shortcuts = [];
    }
    if (b.shortcuts.length > 0) {
      addNumeric = false;
    }
    if (b.shortcuts.length == 0) {
      const assigned = b.label?.includes("<u>") ? b.label.substr(b.label.indexOf("<u>") + 3, 1).toLowerCase() : null;

      if (assigned && assigned != "<") {
        //to avoid <u></u>
        b.shortcuts.push(assigned);
        addNumeric = false;
      } else if (shortcut <= 9 && addNumeric) {
        b.shortcuts.push(String(shortcut));
        shortcut++;
      }
    }
  }
}

export function finalizeShortcuts(buttons: ButtonData[]) {
  for (const button of buttons) {
    if (button.buttons) {
      finalizeShortcuts(button.buttons);
    }
  }
  const shown = buttons.filter((b) => !b.hide);
  addDefaultShortcuts(shown);

  if (shown.length == 1) {
    addSingleButtonShortcut(shown[0]);
  }
}
