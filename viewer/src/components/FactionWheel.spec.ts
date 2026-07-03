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

    // The 4 extra planets sit in a compact 2x2 grid directly under the ring (narrower than a
    // single row of 4, so it no longer widens the wheel's overall footprint), rendered as circles
    // like the ring's own planet markers rather than squares.
    const position = (planet: Planet): { x: number; y: number } => {
      const el = container.querySelector(`.faction-wheel-extra-planet[data-planet="${planet}"]`);
      const [x, y] = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(el.getAttribute("transform")).slice(1).map(Number);
      return { x, y };
    };
    const positions = [Planet.Gaia, Planet.Transdim, Planet.Asteroid, Planet.Protoplanet].map(position);
    const ys = new Set(positions.map((p) => p.y));
    const xs = new Set(positions.map((p) => p.x));
    expect(ys.size).to.equal(2);
    expect(xs.size).to.equal(2);
    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).to.equal(4);

    for (const planet of [Planet.Gaia, Planet.Transdim, Planet.Asteroid, Planet.Protoplanet]) {
      const el = container.querySelector(`.faction-wheel-extra-planet[data-planet="${planet}"]`);
      expect(el.querySelector("circle.planet-fill"), `${planet} should render as a circle`).to.not.equal(null);
      expect(el.querySelector("rect")).to.equal(null);
    }
  });
});
