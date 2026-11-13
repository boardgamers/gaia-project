import Engine, { Planet } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import Vue from "vue";
import OldSpaceHex from "../../../old-ui/src/components/SpaceHex.vue";
import { MapModeType } from "../data/actions";
import { makeStore } from "../store";
import SpaceHex from "./SpaceHex.vue";

for (const [name, component] of [
  ["current", SpaceHex],
  ["alternate", OldSpaceHex],
] as const) {
  describe(`${name} white planet-type highlight`, () => {
    it("outlines the existing Ice disc only while its type matches, without adding markers or selection", async () => {
      const engine = new Engine(["init 2 white-planet-contrast"]);
      const store = makeStore();
      store.commit("receiveData", engine);
      const hex = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Ice);
      const { container } = render(component, { store, props: { hex } });
      const outline = container.querySelector("circle.planet.i");
      expect(outline).not.to.equal(null);
      const count = container.querySelectorAll("*").length;
      const radius = outline.getAttribute("r");
      const toggle = async (planet: Planet) => {
        store.commit("toggleMapMode", { type: MapModeType.planetType, planet });
        await Vue.nextTick();
      };
      const check = (active: boolean) => {
        expect(outline.classList.contains("planet-type-highlighted")).to.equal(active);
        expect(outline.classList.contains("highlighted")).to.equal(false);
        expect(container.querySelector("use.space-hex").classList.contains("bold")).to.equal(active);
        expect(container.querySelectorAll("*").length).to.equal(count);
        expect(outline.getAttribute("r")).to.equal(radius);
        expect(container.querySelector(".space-hex-federation")).to.equal(null);
      };
      check(false);
      await toggle(Planet.Ice);
      check(true);
      await toggle(Planet.Ice);
      check(false);
      await toggle(Planet.Terra);
      check(false);
    });

    it("preserves build selection independently of the planet-type filter", async () => {
      const engine = new Engine(["init 2 white-planet-contrast"]);
      const store = makeStore();
      store.commit("receiveData", engine);
      const hex = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Ice);
      store.commit("highlightHexes", { hexes: new Map([[hex, {}]]) });
      const { container } = render(component, { store, props: { hex } });
      const circle = container.querySelector("circle.planet.i");
      expect(circle.classList.contains("highlighted")).to.equal(true);
      for (const active of [true, false]) {
        store.commit("toggleMapMode", { type: MapModeType.planetType, planet: Planet.Ice });
        await Vue.nextTick();
        expect(circle.classList.contains("highlighted")).to.equal(true);
        expect(circle.classList.contains("planet-type-highlighted")).to.equal(active);
      }
    });

    it("does not mark other matching planet types", async () => {
      const engine = new Engine(["init 2 white-planet-contrast"]);
      const store = makeStore();
      store.commit("receiveData", engine);
      const hex = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Terra);
      const { container } = render(component, { store, props: { hex } });
      store.commit("toggleMapMode", { type: MapModeType.planetType, planet: Planet.Terra });
      await Vue.nextTick();
      expect(container.querySelector("use.space-hex.bold")).not.to.equal(null);
      expect(container.querySelector(".planet-type-highlighted")).to.equal(null);
    });
  });
}
