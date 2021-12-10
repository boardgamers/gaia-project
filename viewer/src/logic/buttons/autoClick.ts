import { ButtonData } from "../../data";
import { CommandController } from "./types";
import { addOnShow } from "./utils";

export enum AutoClickPolicy {
  Always,
  Never,
  Smart,
}

export type AutoClickStrategy = {
  first: AutoClickPolicy;
  children: AutoClickPolicy;
};

export type AutoClickPreference = "never" | "always" | "smart";

export function autoClickStrategy(pref: AutoClickPreference, preventFirst: boolean): AutoClickStrategy {
  switch (pref) {
    case "always":
      return {
        first: preventFirst ? AutoClickPolicy.Never : AutoClickPolicy.Always,
        children: AutoClickPolicy.Always,
      };
    case "never":
      return {
        first: AutoClickPolicy.Never,
        children: AutoClickPolicy.Never,
      };
  }
  return {
    first: preventFirst ? AutoClickPolicy.Never : AutoClickPolicy.Smart,
    children: AutoClickPolicy.Smart,
  };
}

function allowAutoClick(p: AutoClickPolicy, button: ButtonData): boolean {
  switch (p) {
    case AutoClickPolicy.Always:
      return true;
    case AutoClickPolicy.Smart:
      return button.smartAutoClick;
    case AutoClickPolicy.Never:
      return false;
  }
}

export function setAutoClick(controller: CommandController, button: ButtonData): ButtonData {
  if (button.autoClick != null) {
    return;
  }

  button.disabled = true;
  button.autoClick = true;
  addOnShow(button, () => {
    if (button.autoClick) {
      controller.handleButtonClick(button);
    }
  });
  return button;
}

export function checkAutoClick(controller: CommandController, buttons: ButtonData[], strategy: AutoClickStrategy) {
  for (const b of buttons) {
    if (b.buttons?.length > 0) {
      checkAutoClick(controller, b.buttons, { first: strategy.children, children: strategy.children });
    }
  }

  if (
    buttons.length == 1 &&
    controller.enabledButtonWarnings(buttons[0]).length == 0 &&
    !buttons[0].needConfirm &&
    allowAutoClick(strategy.first, buttons[0])
  ) {
    setAutoClick(controller, buttons[0]);
  }
}
