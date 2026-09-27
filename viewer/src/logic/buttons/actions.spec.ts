import { BoardAction, Command } from "@gaia-project/engine";
import { describe, expect, it, vi } from "vitest";
import { combinedBoardActionsButton, specialActionsButton } from "./actions";
import { AutoClickPolicy } from "./autoClick";
import { commandButtons } from "./commands";
import type { CommandController } from "./types";

describe("combined public actions menu", () => {
  function fixture(withBoard = true) {
    let onAction: (action: any) => void;
    const unsubscribe = vi.fn();
    const controller = {
      highlightBoardActions: vi.fn(),
      handleButtonClick: vi.fn(),
      emitButtonCommand: vi.fn(),
      subscribeAction: vi.fn((handler) => {
        onAction = handler;
        return unsubscribe;
      }),
    } as unknown as CommandController;
    const board = withBoard
      ? {
          label: "Power/Q.I.C Action",
          command: Command.Action,
          buttons: [{ label: "Power", command: BoardAction.Power1 }],
        }
      : undefined;
    const ships = {
      label: "Ship Action",
      command: Command.SpaceshipAction,
      buttons: [{ label: "Twilight", command: "twilight qic", richText: [{ text: "Cost and effect" }] }],
    };
    const menu = combinedBoardActionsButton(board, ships, controller);
    return { menu, controller, dispatch: (action: any) => onAction(action), unsubscribe };
  }
  it("keeps complete engine commands and the ship's cost/effect rendering in one flat menu", () => {
    const { menu } = fixture();
    expect(menu.command).toBeUndefined();
    expect(menu.buttons.map((b) => b.command)).toEqual([
      `${Command.Action} ${BoardAction.Power1}`,
      `${Command.SpaceshipAction} twilight qic`,
    ]);
    expect(menu.buttons[1].richText).toEqual([{ text: "Cost and effect" }]);
  });
  it("routes direct board clicks through the matching prefixed choice, and ignores unavailable actions", () => {
    const { menu, controller, dispatch } = fixture();
    menu.onClick(menu);
    expect(controller.emitButtonCommand).toHaveBeenCalledWith(menu, null, { disappear: false });
    dispatch({ type: "boardActionClick", payload: { command: BoardAction.Power1 } });
    expect(controller.handleButtonClick).toHaveBeenCalledWith(menu.buttons[0]);
    dispatch({ type: "boardActionClick", payload: { command: "unavailable" } });
    expect(controller.handleButtonClick).toHaveBeenCalledTimes(1);
  });
  it("still offers ship actions when no base-board action is available", () => {
    const { menu, controller } = fixture(false);
    expect(menu.buttons).toHaveLength(1);
    expect(menu.buttons[0].command).toBe(`${Command.SpaceshipAction} twilight qic`);
    menu.onClick(menu);
    expect(controller.highlightBoardActions).toHaveBeenCalledWith([]);
  });
});

describe("single available action", () => {
  const controller = {
    customButtons: [],
    enabledButtonWarnings: () => [],
    handleButtonClick: vi.fn(),
  } as unknown as CommandController;
  const strategy = { first: AutoClickPolicy.Never, children: AutoClickPolicy.Never };

  it("shows the sole special action effect and emits the full command only on activation", () => {
    const button = specialActionsButton(
      { name: Command.Special, data: { specialacts: [{ income: "3o" }] } } as any,
      null,
      controller
    );
    expect(button.command).toBe(`${Command.Special} 3o`);
    expect(button.richText).toEqual([{ specialAction: "3o" }]);
    expect(button.buttons).toBeUndefined();
    expect(button.onShow).toBeUndefined();
    expect(button.shortcuts).toEqual(["s"]);
    expect(controller.handleButtonClick).not.toHaveBeenCalled();
  });

  it("retains the menu for multiple special actions", () => {
    const button = specialActionsButton(
      { name: Command.Special, data: { specialacts: [{ income: "3o" }, { income: "4pw" }] } } as any,
      null,
      controller
    );
    expect(button.mobileIcon).toBe("special-actions");
    expect(button.buttons).toHaveLength(2);
  });

  it("flattens a sole board action without losing its prefix or effect", () => {
    const buttons = commandButtons(
      [{ name: Command.Action, data: { poweracts: [{ name: BoardAction.Power1 }] } }] as any,
      {} as any,
      null,
      controller,
      strategy,
      0
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].command).toBe(`${Command.Action} ${BoardAction.Power1}`);
    expect(buttons[0].richText.length).toBeGreaterThan(0);
    expect(buttons[0].buttons).toBeUndefined();
    expect(buttons[0].autoClick).toBeUndefined();
  });
});
