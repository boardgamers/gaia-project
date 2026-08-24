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

    // Gaia/Transdim sit in a row below the ring (clear of its lowest circles); Asteroid/Protoplanet
    // sit in their own column to the right of the ring instead of a 3rd/4th slot below it, rendered
    // as circles like the ring's own planet markers rather than squares.
    const position = (planet: Planet): { x: number; y: number } => {
      const el = container.querySelector(`.faction-wheel-extra-planet[data-planet="${planet}"]`);
      const [x, y] = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(el.getAttribute("transform")).slice(1).map(Number);
      return { x, y };
    };
    const positions = [Planet.Gaia, Planet.Transdim, Planet.Asteroid, Planet.Protoplanet].map(position);
    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).to.equal(4);

    const [gaia, transdim, asteroid, protoplanet] = positions;
    // Below the ring: same y, two distinct x's.
    expect(gaia.y).to.equal(transdim.y);
    expect(gaia.x).to.not.equal(transdim.x);
    // Right of the ring: same x, two distinct y's.
    expect(asteroid.x).to.equal(protoplanet.x);
    expect(asteroid.y).to.not.equal(protoplanet.y);
    // The right-hand column must actually be to the right of the below-wheel row.
    expect(asteroid.x).to.be.greaterThan(Math.max(gaia.x, transdim.x));
    // Regression guard: the ring's own circles reach at most ~3.93 from center (radius 3 + their
    // own radius 1, at the widest point of the 7-position layout) - both extra rows must clear
    // that with real margin, not just touch it.
    expect(gaia.y).to.be.greaterThan(4.5);
    expect(asteroid.x).to.be.greaterThan(4.5);

    for (const planet of [Planet.Gaia, Planet.Transdim, Planet.Asteroid, Planet.Protoplanet]) {
      const el = container.querySelector(`.faction-wheel-extra-planet[data-planet="${planet}"]`);
      expect(el.querySelector("circle.planet-fill"), `${planet} should render as a circle`).to.not.equal(null);
      expect(el.querySelector("rect")).to.equal(null);
    }
  });
});
