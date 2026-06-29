import Engine, { classifySectorId, LostFleetSectorType } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import fs from "fs";
import { makeStore } from "../store";
import SpaceMap from "./SpaceMap.vue";

// Loads a real (finished) game from the engine's own fixtures rather than hand-rolling a
// minimal state, so this exercises the actual hex/building/ship/federation rendering paths
// that the Vue 2 reactivity + <defs> perf refactor (see docs/lost-fleet/PERFORMANCE.md) touched.
// Path is relative to the `viewer` package root (cwd when `pnpm test` runs), matching the
// convention already used by src/logic/test-utils.ts for its own fixtures.
function loadFixtureEngine(): Engine {
  const data = JSON.parse(fs.readFileSync("../engine/fixtures/Beta-2.json").toString());
  return Engine.fromData(data);
}

describe("SpaceMap", () => {
  it("renders the full hex map for a real game state without throwing", () => {
    const engine = loadFixtureEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    const sectors = container.querySelectorAll("g.sector");
    expect(sectors.length).to.equal(engine.map.configuration().centers.length);

    const hexes = container.querySelectorAll("g.sector > g");
    expect(hexes.length).to.equal(engine.map.grid.size);

    // Definitions.vue/Filters.vue/Buildings.vue each declare one static <defs> block,
    // rendered once globally regardless of hex count. This guards against a regression of the
    // pre-fix bug where federation gradients were duplicated into every SpaceHex instance
    // (~4,500 nodes for ~90 hexes) instead of being hoisted into FederationGradients.vue.
    expect(container.querySelectorAll("defs").length).to.equal(3);
    expect(container.querySelector("#federation-gradient-line-r")).to.not.be.null;
  });

  it("renders Lost Fleet Interspace and Deep Space hexes in addition to the base sectors", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    const sectors = container.querySelectorAll("g.sector");
    expect(sectors.length).to.equal(engine.map.configuration().centers.length);

    const totalHexes = container.querySelectorAll("g.space-hex-cell");
    expect(totalHexes.length).to.equal(engine.map.grid.size);

    const interspaceHexCount = [...engine.map.grid.values()].filter(
      (hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Interspace
    ).length;
    const deepSpaceHexCount = [...engine.map.grid.values()].filter(
      (hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace
    ).length;
    const spaceshipHexCount = [...engine.map.grid.values()].filter((hex) => hex.data.spaceship !== undefined).length;

    expect(interspaceHexCount).to.be.greaterThan(0);
    expect(deepSpaceHexCount).to.be.greaterThan(0);
    expect(container.querySelectorAll("g.space-hex-cell .lost-fleet-spaceship").length).to.equal(spaceshipHexCount);
  });
});
