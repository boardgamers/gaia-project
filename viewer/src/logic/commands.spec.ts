import { AvailableFreeAction, FreeAction, Player } from "@gaia-project/engine";
import { expect } from "chai";
import { ButtonData } from "../data";
import { freeActionButton, withShortcut } from "./commands";

describe("commands", () => {
  it("should assign shortcut for free action", () => {
    const avail: AvailableFreeAction = {
      action: FreeAction.PowerToOreAndCredit,
    };

    const button = freeActionButton({ acts: [avail] }, { data: {tokenModifier: 2} } as Player);
    expect(button).to.deep.equal([
      {
        command: "spend 4pw for 1o,1c",
        conversion: {
          from: [
            {
              count: 2,
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
        label: "4 Power Charges ⇒ 1 Ore and 1 Cred<u>i</u>t",
        shortcuts: ["i"],
        times: undefined,
      },
    ] as ButtonData[]);
  });

  it("should add shortcut underline", () => {
    const s = withShortcut("5 Power Charges => 2 Terraforming steps", "e", ["Power Charges", "Terraforming"]);
    expect(s).to.equal("5 Power Charges => 2 Terraforming st<u>e</u>ps");
  });
});
