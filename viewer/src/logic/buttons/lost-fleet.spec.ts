import Engine, { AvailableCommand, Command, GaiaHex, Reward } from "@gaia-project/engine";
import { Planet, Spaceship } from "@gaia-project/engine/src/enums";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import SpaceMap from "../../components/SpaceMap.vue";
import { makeStore } from "../../store";
import { examineArtifactButton, exploreButton, instantGaiaformingButton, placePowerRingButton } from "./lost-fleet";
import type { CommandController } from "./types";

function rewardStrings(rewards: Reward[]): string[] {
  return rewards.map((r) => r.toString());
}

function lostFleetEngine(): Engine {
  return new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
}

function controllerStub(): CommandController {
  return { isWarningEnabled: () => true } as any as CommandController;
}

/** The class SpaceHex.vue puts on a hex's background polygon once the selection is highlighted. */
function hexClasses(engine: Engine, hexes: any, hex: GaiaHex): string[] {
  const store = makeStore();
  store.commit("receiveData", engine);
  store.commit("highlightHexes", hexes);

  const { container } = render(SpaceMap, { store });
  const cell = container.querySelector(`g.space-hex-cell[id="${hex}"] use.space-hex`);
  expect(cell, `expected hex ${hex} to be rendered`).to.not.equal(null);
  return cell.getAttribute("class").split(" ");
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

  // Both actions used to build their hex selection with `selectedLight: true`, which renders a
  // selectable hex as nothing but `opacity: .7` over its normal dark fill - indistinguishable from
  // an untouched map. Their targets are normally free (a transdim planet already in range costs
  // "~"; a power-ring target has no cost at all), so they never fell into the visible "qic"/"warn"
  // branches either, and the map stayed blank while the button list offered coordinates to pick.
  describe("map highlight for hex-selection actions", () => {
    it("marks instant Gaiaforming targets on the map the same way a build target is marked", () => {
      const engine = lostFleetEngine();
      const hex = [...engine.map.grid.values()].find((h) => h.data.planet === Planet.Transdim);
      expect(hex, "expected a transdim planet on the board").to.not.equal(undefined);

      const command: AvailableCommand<Command.GaiaFormTransdim> = {
        name: Command.GaiaFormTransdim,
        data: { spaces: [{ coordinates: hex.toString(), cost: "~", warnings: null }] },
      } as any;

      const button = instantGaiaformingButton(controllerStub(), engine, command);
      const classes = hexClasses(engine, button.hexes, hex);

      expect(classes).to.include("bold");
      expect(classes).to.include("pointer");
      expect(classes).to.not.include("light");
    });

    it("marks power-ring targets on the map, which carry no cost at all", () => {
      const engine = lostFleetEngine();
      const hex = [...engine.map.grid.values()].find((h) => h.data.planet !== Planet.Empty);
      expect(hex, "expected a planet on the board").to.not.equal(undefined);

      const command: AvailableCommand<Command.PlacePowerRing> = {
        name: Command.PlacePowerRing,
        data: { spaces: [{ coordinates: hex.toString() }] },
      } as any;

      const button = placePowerRingButton(controllerStub(), engine, command);
      const classes = hexClasses(engine, button.hexes, hex);

      expect(classes).to.include("bold");
      expect(classes).to.include("pointer");
      expect(classes).to.not.include("light");
    });
  });
});
