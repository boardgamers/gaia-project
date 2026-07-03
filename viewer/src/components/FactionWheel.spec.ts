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

    // The 4 extra planets sit in a single compact row directly under the ring (not a 2x2 block,
    // which doubled the wheel's height) - same y, distinct x, all 4 distinct positions.
    const position = (planet: Planet): { x: number; y: number } => {
      const el = container.querySelector(`.faction-wheel-extra-planet[data-planet="${planet}"]`);
      const [x, y] = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(el.getAttribute("transform")).slice(1).map(Number);
      return { x, y };
    };
    const positions = [Planet.Gaia, Planet.Transdim, Planet.Asteroid, Planet.Protoplanet].map(position);
    const ys = new Set(positions.map((p) => p.y));
    const xs = new Set(positions.map((p) => p.x));
    expect(ys.size).to.equal(1);
    expect(xs.size).to.equal(4);
  });
});
