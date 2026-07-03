import Engine, { Building, classifySectorId, Faction, LostFleetSectorType, Planet } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import fs from "fs";
import { hexCenter } from "../graphics/hex";
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
    expect(container.querySelectorAll('[data-sector-type="interspace"]').length).to.equal(interspaceHexCount);
    expect(container.querySelectorAll('[data-sector-type="deep-space"]').length).to.equal(deepSpaceHexCount);

    // badges carry the full tile id (IS3, DS14) so they match the hex-selection button labels
    container.querySelectorAll('[data-sector-type="interspace"] text').forEach((badge) => {
      expect(badge.textContent.trim()).to.match(/^IS\d+$/);
    });
    container.querySelectorAll('[data-sector-type="deep-space"] text').forEach((badge) => {
      expect(badge.textContent.trim()).to.match(/^DS\d+$/);
    });
    expect(container.querySelectorAll("g.space-hex-cell .lost-fleet-spaceship").length).to.equal(spaceshipHexCount);
    // per-hex ship marker matches the ship board's own minimal circle+letter treatment (same
    // #efe6c4/#172e62 colors) - no separate orbit ring or "Ship" caption pill on top of it
    const mapShipMarker = container.querySelector("g.space-hex-cell .lost-fleet-spaceship");
    if (mapShipMarker) {
      expect(mapShipMarker.querySelector(".lost-fleet-spaceship__orbit")).to.equal(null);
      expect(mapShipMarker.querySelector(".lost-fleet-spaceship__pill")).to.equal(null);
      expect(mapShipMarker.querySelectorAll("circle").length).to.equal(1);
      expect(mapShipMarker.querySelectorAll("text").length).to.equal(1);
      expect(mapShipMarker.querySelector("text").textContent).to.match(/^[TRME]$/);
    }
    expect(container.querySelector('[data-kind="interspace"]')).to.not.equal(null);
    expect(container.querySelector('[data-kind="deep-space"]')).to.not.equal(null);
    expect(container.querySelector('[data-kind="ship"]')).to.not.equal(null);

    // the legend's Deep Space swatch renders as an actual 3-hex cluster (matching the physical
    // tile), not the same shape as the single-hex Interspace swatch, so the two are distinguishable
    // by more than a subtle color difference.
    expect(container.querySelector('[data-kind="deep-space"] .deep-space-sector')).to.not.equal(null);
    expect(container.querySelectorAll('[data-kind="deep-space"] .deep-space-sector polygon').length).to.equal(3);
  });

  it("sizes the viewBox to contain every hex and keeps the wheel and legends in the left sidebar", () => {
    // The old hardcoded viewBox (-13 -11.5 26|33.5 24) clipped the taller Lost Fleet 3p/4p
    // layouts (top hexes at y=-16.5 / -19.1) and let the faction wheel sit on top of hexes.
    const translateX = (el: Element | null): number => {
      const match = /translate\((-?[\d.]+)/.exec(el?.getAttribute("transform") ?? "");
      expect(match, "expected an anchored transform").to.not.equal(null);
      return Number(match[1]);
    };

    // Lost Fleet 3p is rendered rotated 120deg (hex-grid-aligned) to minimize the viewBox width on
    // narrow phone screens (SpaceMap.vue's mapRotationDeg); 2p/4p are already narrowest at 0deg.
    const rotationDeg = (players: number) => (players === 3 ? 120 : 0);
    const rotate = (x: number, y: number, deg: number) => {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return { x: x * cos - y * sin, y: x * sin + y * cos };
    };

    for (const players of [2, 3, 4]) {
      const engine = new Engine([`init ${players} lost-fleet-space-map`], { lostFleet: true });
      const store = makeStore();
      store.commit("receiveData", engine);

      const { container } = render(SpaceMap, { store });

      const [x, y, w, h] = container.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);
      let minHexX = Infinity;
      for (const hex of engine.map.grid.values()) {
        const raw = hexCenter(hex);
        const c = rotate(raw.x * 1.01, raw.y * 1.01, rotationDeg(players));
        expect(c.x - 1, `${players}p hex ${hex} left of viewBox`).to.be.gte(x);
        expect(c.x + 1, `${players}p hex ${hex} right of viewBox`).to.be.lte(x + w);
        expect(c.y - 1, `${players}p hex ${hex} above viewBox`).to.be.gte(y);
        expect(c.y + 1, `${players}p hex ${hex} below viewBox`).to.be.lte(y + h);
        minHexX = Math.min(minHexX, c.x);
      }

      // The faction wheel (ring spans +-2.6 around its anchor at scale 0.65) and the Lost Fleet
      // legend (5.5 wide) both stay in the reserved sidebar, fully left of the leftmost hex.
      const wheelRight = translateX(container.querySelector(".faction-wheel")) + 2.6;
      expect(wheelRight, `${players}p wheel overlaps hexes`).to.be.below(minHexX - 1);
      const legendRight = translateX(container.querySelector(".lost-fleet-map-legend")) + 5.5;
      expect(legendRight, `${players}p legend overlaps hexes`).to.be.below(minHexX - 1);
    }
  });

  it("keeps Asteroid and Protoplanet planet colors while rendering Lost Fleet player pieces with the correct faction pairing", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    engine.players[0].faction = Faction.Darkanians;
    engine.players[1].faction = Faction.Moweyds;

    const asteroidHex = [...engine.map.grid.values()].find(
      (hex) => !hex.occupied() && hex.data.planet === Planet.Asteroid
    );
    const protoplanetHex = [...engine.map.grid.values()].find(
      (hex) => !hex.occupied() && hex.data.planet === Planet.Protoplanet
    );

    expect(asteroidHex, "need an unoccupied Asteroid hex").to.not.equal(undefined);
    expect(protoplanetHex, "need an unoccupied Protoplanet hex").to.not.equal(undefined);

    asteroidHex.data.building = Building.Mine;
    asteroidHex.data.player = engine.players[0].player;
    protoplanetHex.data.building = Building.Mine;
    protoplanetHex.data.player = engine.players[1].player;

    const store = makeStore();
    store.commit("receiveData", engine);
    store.state.preferences.flatBuildings = true;

    const { container } = render(SpaceMap, { store });

    const darkaniansHex = container.querySelector(`g.space-hex-cell[id="${asteroidHex}"]`);
    const moweydsHex = container.querySelector(`g.space-hex-cell[id="${protoplanetHex}"]`);

    expect(darkaniansHex?.querySelector(".planet-fill.a")).to.not.equal(null);
    expect(darkaniansHex?.querySelector(".planet-fill.faction-fill.a")).to.not.equal(null);
    expect(darkaniansHex?.querySelector(".building .planet-fill.a")).to.not.equal(null);

    expect(moweydsHex?.querySelector(".planet-fill.p")).to.not.equal(null);
    expect(moweydsHex?.querySelector(".planet-fill.faction-fill.p")).to.not.equal(null);
    expect(moweydsHex?.querySelector(".building .planet-fill.p")).to.not.equal(null);
  });
});
