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
    // Deep Space badges: one per physical 3-hex tile, not one per hex - so strictly fewer badge
    // elements than deep-space hexes (assuming every DS tile has all 3 of its hexes on the board).
    const deepSpaceBadges = container.querySelectorAll('[data-sector-type="deep-space"]');
    expect(deepSpaceBadges.length).to.be.greaterThan(0);
    expect(deepSpaceBadges.length).to.be.lessThan(deepSpaceHexCount);

    // Interspace badges reference the sectors they border (e.g. "IS123"), not an arbitrary id;
    // Deep Space badges are now a bare number, not "DS<n>". Sector names aren't always pure
    // digits (extra tiles at higher player counts can be named e.g. "6B"), hence [\dA-Z]+.
    container.querySelectorAll('[data-sector-type="interspace"] text').forEach((badge) => {
      expect(badge.textContent.trim()).to.match(/^IS[\dA-Z]+$/);
    });
    container.querySelectorAll('[data-sector-type="deep-space"] text').forEach((badge) => {
      expect(badge.textContent.trim()).to.match(/^\d+$/);
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

    // the Lost Fleet legend (Interspace/Deep Space/Ship swatches) was removed entirely
    expect(container.querySelector('[data-kind="interspace"]')).to.equal(null);
    expect(container.querySelector('[data-kind="deep-space"]')).to.equal(null);
    expect(container.querySelector('[data-kind="ship"]')).to.equal(null);
  });

  it("shows the 7 Tinkeroids/Moweyds terraforming-board colors as plain squares, top-right of the map", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    // plain <rect> elements, no wrapping <g>/<text> - "just squares, no text or container"
    const squares = container.querySelectorAll("rect.lost-fleet-terraform-swatch");
    expect(squares.length).to.equal(7);
    squares.forEach((sq) => {
      expect(sq.getAttribute("width")).to.equal("0.9");
      expect(sq.getAttribute("height")).to.equal("0.9");
      expect(sq.children.length).to.equal(0);
    });
    // deterministic from the seed, same source as LostFleetTerraformingBoard.vue's own row
    const colors = [...squares].map((sq) => sq.getAttribute("class").split(" ")[2]);
    expect(new Set(colors).size).to.equal(7); // all 7 distinct planet types, no repeats
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

      // The faction wheel (ring spans +-2.6 around its anchor at scale 0.65) stays in the
      // reserved sidebar, fully left of the leftmost hex. (There is no separate Lost Fleet
      // legend anymore - it was removed; the wheel is the only thing reserving this sidebar now.)
      const wheelRight = translateX(container.querySelector(".faction-wheel")) + 2.6;
      expect(wheelRight, `${players}p wheel overlaps hexes`).to.be.below(minHexX - 1);
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
