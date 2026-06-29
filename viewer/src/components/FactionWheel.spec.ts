import Engine, { Planet } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import FactionWheel from "./FactionWheel.vue";

describe("FactionWheel", () => {
  it("keeps the base game wheel to nine planets", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(["init 2 faction-wheel-base"]));

    const { container } = render(FactionWheel, { store });

    expect(container.querySelectorAll(".faction-wheel-planet").length).to.equal(9);
    expect(container.querySelector(`[data-planet="${Planet.Asteroid}"]`)).to.equal(null);
    expect(container.querySelector(`[data-planet="${Planet.Protoplanet}"]`)).to.equal(null);
  });

  it("adds Asteroid and Protoplanet to the wheel in Lost Fleet", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(["init 2 faction-wheel-lost-fleet"], { lostFleet: true }));

    const { container } = render(FactionWheel, { store });

    expect(container.querySelectorAll(".faction-wheel-planet").length).to.equal(11);
    expect(container.querySelector(`[data-planet="${Planet.Asteroid}"]`)).to.not.equal(null);
    expect(container.querySelector(`[data-planet="${Planet.Protoplanet}"]`)).to.not.equal(null);
  });
});
