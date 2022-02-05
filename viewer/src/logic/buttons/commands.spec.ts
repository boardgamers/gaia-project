import {
  AvailableFreeAction,
  Booster,
  FreeAction,
  freeActionConversions,
  Player,
  PlayerData,
  Power,
} from "@gaia-project/engine";
import { expect } from "chai";
import { WarningWithKey } from "../../data";
import { freeActionButton } from "./conversion";
import { boosterWarning } from "./pass";
import { withShortcut } from "./shortcuts";

describe("commands", () => {
  it("should assign shortcut for free action", () => {
    const avail: AvailableFreeAction = freeActionConversions[FreeAction.PowerToOreAndCredit];

    const playerData = new PlayerData();
    playerData.tokenModifier = 2;
    const button = freeActionButton({ acts: [avail] }, { data: playerData } as Player);
    expect(button).to.deep.equal({
      buttons: [
        {
          command: "spend 4pw for 1o,1c",
          boardAction: null,
          richText: [
            {
              rewards: [
                {
                  count: 2,
                  type: "pay-pw",
                },
              ],
            },
            {
              text: "arrow",
            },
            {
              rewards: [
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
          ],
          label: "<u></u>",
          longLabel: "4 Power Charges ⇒ 1 Ore and 1 Credit",
          shortcuts: ["i"],
          times: undefined,
          tooltip: "4 Power Charges ⇒ 1 Ore and 1 Cred<u>i</u>t",
          warning: null,
        },
      ],
      tooltips: {
        o: "4 Power Charges ⇒ 1 Ore and 1 Cred<u>i</u>t",
      },
    });
  });

  it("should add shortcut underline", () => {
    const s = withShortcut("5 Power Charges => 2 Terraforming steps", "e", ["Power Charges", "Terraforming"]);
    expect(s).to.equal("5 Power Charges => 2 Terraforming st<u>e</u>ps");
  });

  describe("booster warnings", () => {
    const tests: {
      name: string;
      power: Power;
      ores: number;
      booster: Booster;
      warnings: WarningWithKey[] | null;
    }[] = [
      {
        name: "no warnings - o booster",
        power: new Power(0, 0, 1),
        ores: 14,
        booster: Booster.Booster1,
        warnings: undefined,
      },
      {
        name: "no warnings - 4pw booster",
        power: new Power(1, 2, 0),
        ores: 15,
        booster: Booster.Booster9,
        warnings: undefined,
      },
      {
        name: "warnings - o booster",
        power: new Power(0, 0, 1),
        ores: 15,
        booster: Booster.Booster1,
        warnings: [
          {
            disableKey: "resource-waste",
            message: "1o will be wasted during income phase.",
          },
        ],
      },
      {
        name: "warnings - 4pw booster",
        power: new Power(1, 1, 0),
        ores: 15,
        booster: Booster.Booster9,
        warnings: [
          {
            disableKey: "resource-waste",
            message: "1 power charges will be wasted during income phase.",
          },
        ],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.data.power = test.power;
        player.data.ores = test.ores;

        const buttonWarning = boosterWarning(player, test.booster);
        expect(buttonWarning?.body).to.deep.equal(test.warnings);
      });
    }
  });
});
