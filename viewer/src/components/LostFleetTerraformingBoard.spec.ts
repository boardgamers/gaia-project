import Engine, { Planet } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import LostFleetTerraformingBoard from "./LostFleetTerraformingBoard.vue";

describe("LostFleetTerraformingBoard", () => {
  it("shows currently mandatory colors during setup, without a shared-row or per-player box", () => {
    const engine = new Engine(
      ["init 3 lost-fleet-terraforming-setup", "p1 faction tinkeroids", "p2 faction terrans"],
      { lostFleet: true }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetTerraformingBoard, { store });

    expect(container.querySelector('[data-row="mandatory"]')).to.not.equal(null);
    expect(container.querySelector('[data-row="mandatory"] [data-planet="' + Planet.Terra + '"]')?.getAttribute("data-selected")).to.equal(
      "true"
    );
    // The shared 7-color row and per-player "exact 3-step planets" card were removed - the row
    // duplicated SpaceMap.vue's top-right swatches, and resolved colors already live on each
    // player's own faction board (PlayerInfo.vue).
    expect(container.querySelector('[data-row="board"]')).to.equal(null);
    expect(container.querySelector("[data-player]")).to.equal(null);
    expect(container.textContent).to.not.contain("Shared row");
    expect(container.textContent).to.not.contain("Final 3-step colors resolve after all factions are chosen.");
  });

  it("renders nothing once faction setup finishes and there's no mandatory-so-far content left to show", () => {
    const engine = new Engine(
      [
        "init 3 lost-fleet-terraforming-resolved",
        "p1 faction tinkeroids",
        "p2 faction bescods",
        "p3 faction moweyds",
      ],
      { lostFleet: true }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetTerraformingBoard, { store });

    // Resolved Tinkeroids/Moweyds cost-3 colors now live only on PlayerInfo.vue's own faction
    // board (see PlayerInfo.spec.ts), not duplicated here.
    expect(container.querySelector(".lost-fleet-terraforming-board")).to.equal(null);
  });
});
