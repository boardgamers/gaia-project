import { expect } from "chai";
import { ButtonData } from "../../data";
import { AutoClickPolicy, checkAutoClick } from "./autoClick";
import { CommandController } from "./types";

// The confirmation press is what analysis mode drops (ANALYSIS_MODE_PLAN.md §12): a sandbox turn fires
// as soon as it is composed, because Undo already covers a misclick and a round-0 line otherwise
// spends a press per seat confirming placements the player has to make for everybody.
function controllerStub(analysisMode: boolean, warnings: string[] = []): CommandController & { clicked: ButtonData[] } {
  const clicked: ButtonData[] = [];
  return {
    analysisMode,
    clicked,
    enabledButtonWarnings: () => warnings,
    handleButtonClick: (b: ButtonData) => clicked.push(b),
  } as any;
}

/** checkAutoClick only arms the click (via addOnShow); firing it is the button's own render. */
function armed(button: ButtonData): boolean {
  return button.autoClick === true;
}

const strategy = { first: AutoClickPolicy.Never, children: AutoClickPolicy.Never };

describe("checkAutoClick", () => {
  it("auto-clicks a lone confirmation in analysis mode, whatever the player's auto-click preference", () => {
    const button: ButtonData = { label: "Confirm Mine", command: "", needConfirm: true };

    checkAutoClick(controllerStub(true), [button], strategy);

    expect(armed(button)).to.equal(true);
  });

  it("leaves the confirmation alone in ordinary play", () => {
    const button: ButtonData = { label: "Confirm Mine", command: "", needConfirm: true };

    checkAutoClick(controllerStub(false), [button], strategy);

    expect(armed(button)).to.not.equal(true);
  });

  it("still respects a warning on the button - analysis mode is not a reason to skip those", () => {
    const button: ButtonData = { label: "Confirm Mine", command: "", needConfirm: true };

    checkAutoClick(controllerStub(true, ["this destroys a gaiaformer"]), [button], strategy);

    expect(armed(button)).to.not.equal(true);
  });

  it("does not fire an ordinary single-option button in analysis mode, so opening a menu never plays a move", () => {
    const button: ButtonData = { label: "Mine", command: "build m" };

    checkAutoClick(controllerStub(true), [button], strategy);

    expect(armed(button)).to.not.equal(true);
  });

  it("leaves a confirmation alone while it is one of several buttons", () => {
    const confirm: ButtonData = { label: "Confirm Mine", command: "", needConfirm: true };
    const other: ButtonData = { label: "Back", command: "" };

    checkAutoClick(controllerStub(true), [confirm, other], strategy);

    expect(armed(confirm)).to.not.equal(true);
  });

  it("reaches a confirmation nested under its parent button", () => {
    const confirm: ButtonData = { label: "Confirm Mine", command: "", needConfirm: true };
    const parent: ButtonData = { label: "Mine", command: "build m", buttons: [confirm] };

    checkAutoClick(controllerStub(true), [parent], strategy);

    expect(armed(confirm)).to.equal(true);
  });
});
