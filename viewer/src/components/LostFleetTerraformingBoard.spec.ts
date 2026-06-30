import Engine, { Planet } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import LostFleetTerraformingBoard from "./LostFleetTerraformingBoard.vue";

describe("LostFleetTerraformingBoard", () => {
  it("shows the seeded 7-color row and currently mandatory colors during setup", () => {
    const engine = new Engine(
      ["init 3 lost-fleet-terraforming-setup", "p1 faction tinkeroids", "p2 faction terrans"],
      { lostFleet: true }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetTerraformingBoard, { store });

    expect(container.querySelectorAll('[data-row="board"] [data-slot]').length).to.equal(7);
    expect(container.querySelector('[data-row="mandatory"]')).to.not.equal(null);
    expect(container.querySelector('[data-row="mandatory"] [data-planet="' + Planet.Terra + '"]')?.getAttribute("data-selected")).to.equal(
      "true"
    );
    expect(container.textContent).to.contain("Final 3-step colors resolve after all factions are chosen.");
  });

  it("shows resolved 3-step colors for Tinkeroids and Moweyds after faction setup", () => {
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

    const tinkeroidsPlanets = engine.players[0].data.lostFleetCost3Planets;
    const moweydsPlanets = engine.players[2].data.lostFleetCost3Planets;

    expect(container.querySelector('[data-player="tinkeroids"]')).to.not.equal(null);
    expect(container.querySelector('[data-player="moweyds"]')).to.not.equal(null);
    expect(container.querySelectorAll('[data-player="tinkeroids"] [data-selected="true"]').length).to.equal(3);
    expect(container.querySelectorAll('[data-player="moweyds"] [data-selected="true"]').length).to.equal(3);

    tinkeroidsPlanets.forEach((planet) => {
      expect(container.querySelector('[data-player="tinkeroids"] [data-planet="' + planet + '"]')?.getAttribute("data-selected")).to.equal(
        "true"
      );
    });

    moweydsPlanets.forEach((planet) => {
      expect(container.querySelector('[data-player="moweyds"] [data-planet="' + planet + '"]')?.getAttribute("data-selected")).to.equal(
        "true"
      );
    });
  });
});
