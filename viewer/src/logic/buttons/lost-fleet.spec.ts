import { AvailableCommand, Command, Reward } from "@gaia-project/engine";
import { Spaceship } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { examineArtifactButton, exploreButton } from "./lost-fleet";

function rewardStrings(rewards: Reward[]): string[] {
  return rewards.map((r) => r.toString());
}

describe("lost-fleet buttons", () => {
  describe("exploreButton", () => {
    it("shows a standalone cost (no exploration-slot charge) as a plain, unsigned number", () => {
      const command: AvailableCommand<Command.Explore> = {
        name: Command.Explore,
        data: {
          ships: [{ ship: Spaceship.Twilight, coordinates: "0,0", cost: "5vp", charge: 0, slot: 1, adjustments: [] }],
        },
      } as any;

      const [button] = exploreButton(command).buttons;
      const rewardsElement = button.richText.find((el) => el.rewards);
      expect(rewardStrings(rewardsElement.rewards)).to.deep.equal(["5vp"]);
      expect(rewardsElement.noPlus).to.equal(true);
    });

    it("still shows the cost as a plain, unsigned number even when a later exploration slot's power charge is gained alongside it - consistent across ships in the same list, some of which gain no charge", () => {
      const command: AvailableCommand<Command.Explore> = {
        name: Command.Explore,
        data: {
          ships: [{ ship: Spaceship.TFMars, coordinates: "0,0", cost: "2q,5vp", charge: 2, slot: 2, adjustments: [] }],
        },
      } as any;

      const [button] = exploreButton(command).buttons;
      const [costElement, chargeElement] = button.richText.filter((el) => el.rewards);
      expect(rewardStrings(costElement.rewards)).to.deep.equal(["2q", "5vp"]);
      expect(costElement.noPlus).to.equal(true);
      expect(rewardStrings(chargeElement.rewards)).to.deep.equal(["2pw"]);
    });
  });

  describe("examineArtifactButton", () => {
    it("shows the token cost as a plain, unsigned number, matching a standalone cost", () => {
      const command: AvailableCommand<Command.ExamineArtifact> = {
        name: Command.ExamineArtifact,
        data: { cost: "6t" },
      } as any;

      const button = examineArtifactButton(command);
      const rewardsElement = button.richText.find((el) => el.rewards);
      expect(rewardStrings(rewardsElement.rewards)).to.deep.equal(["6t"]);
      expect(rewardsElement.noPlus).to.equal(true);
    });
  });
});
