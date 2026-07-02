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

    // The 4 extra planets stack 2x2 below the ring instead of widening it: Gaia/Transdim on the
    // first row, Asteroid/Protoplanet on the second.
    const rowY = (planet: Planet): number => {
      const el = container.querySelector(`.faction-wheel-extra-planet[data-planet="${planet}"]`);
      return Number(/,\s*(-?[\d.]+)\)/.exec(el.getAttribute("transform"))[1]);
    };
    expect(rowY(Planet.Gaia)).to.equal(rowY(Planet.Transdim));
    expect(rowY(Planet.Asteroid)).to.equal(rowY(Planet.Protoplanet));
    expect(rowY(Planet.Asteroid)).to.be.above(rowY(Planet.Gaia));
  });
});
