import { AvailableFreeAction, FreeAction } from "@gaia-project/engine";
import { expect } from "chai";
import { ButtonData } from "../data";
import { freeActionButton } from "./commands";

describe("commands", () => {
  it("should assign shortcut for free action", () => {
    const avail: AvailableFreeAction = {
      action: FreeAction.PowerToOreAndCredit,
    };
    const button = freeActionButton({ acts: [avail] });
    expect(button).to.deep.equal([
      {
        command: "spend 4pw for 1o,1c",
        conversion: {
          from: [
            {
              count: 4,
              type: "pay-pw",
            },
          ],
          to: [
            {
              count: 1,
              type: "o",
            },
            {
              count: 1,
              type: "c",
            },
          ],
        },
        label: "4 Power Charges ⇒ 1 Ore and 1 Credit",
        shortcuts: ["3"],
        times: undefined,
      },
    ] as ButtonData[]);
  });
});
