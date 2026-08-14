import Engine, {
  Building,
  classifySectorId,
  Faction,
  GaiaHex,
  LostFleetSectorType,
  Planet,
  PlayerEnum,
} from "@gaia-project/engine";
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

    expect(container.querySelector("svg")?.classList.contains("space-map-canvas")).to.equal(true);
    expect(container.querySelector(".space-map__chart-button")).to.not.equal(null);

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

  it("marks opponent mine placements and building upgrades since the viewer's previous turn", () => {
    const engine = loadFixtureEngine();
    const [ownHex, mineHex, upgradeHex] = [...engine.map.grid.values()].slice(0, 3);
    const ownFaction = engine.players[PlayerEnum.Player1].faction;
    const opponentFaction = engine.players[PlayerEnum.Player2].faction;
    (engine as any).moveHistory = [
      `init ${engine.players.length} recent-build-map`,
      `${ownFaction} build m ${ownHex}`,
      `${opponentFaction} build m ${mineHex}`,
      `${opponentFaction} build ts ${upgradeHex}`,
    ];
    (engine as any).advancedLog = [
      { player: PlayerEnum.Player1, move: 1 },
      { player: PlayerEnum.Player2, move: 2 },
      { player: PlayerEnum.Player2, move: 3 },
      { player: PlayerEnum.Player1 },
    ];

    const store = makeStore();
    store.commit("player", { index: PlayerEnum.Player1 });
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });
    const markers = [...container.querySelectorAll(".recent-opponent-building")];

    expect(markers.map((marker) => marker.getAttribute("data-recent-opponent-building"))).to.deep.equal(["m", "ts"]);
    expect(markers.map((marker) => marker.closest(".space-hex-cell")?.id)).to.deep.equal([
      mineHex.toString(),
      upgradeHex.toString(),
    ]);
    expect(markers.some((marker) => marker.closest(".space-hex-cell")?.id === ownHex.toString())).to.equal(false);
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
    // Spaceship hexes are themselves Interspace hexes, but their "IS…" sector-badge label is
    // suppressed (the ship color + letter already identify them), so only non-ship interspace
    // hexes render a badge.
    const interspaceBadgeCount = [...engine.map.grid.values()].filter(
      (hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Interspace && hex.data.spaceship === undefined
    ).length;

    expect(interspaceHexCount).to.be.greaterThan(0);
    expect(deepSpaceHexCount).to.be.greaterThan(0);
    expect(container.querySelectorAll('[data-sector-type="interspace"]').length).to.equal(interspaceBadgeCount);
    // Deep Space labels: one per physical 3-hex tile, not one per hex - so strictly fewer label
    // elements than deep-space hexes (assuming every DS tile has all 3 of its hexes on the board).
    // Rendered directly by SpaceMap.vue now (a `.sector-name`-styled <text>, not a per-hex badge
    // in SpaceHex.vue), so the element itself carries `data-sector-type`.
    const deepSpaceLabels = container.querySelectorAll('[data-sector-type="deep-space"]');
    expect(deepSpaceLabels.length).to.be.greaterThan(0);
    expect(deepSpaceLabels.length).to.be.lessThan(deepSpaceHexCount);
    deepSpaceLabels.forEach((label) => {
      expect(label.tagName).to.equal("text");
      expect(label.classList.contains("sector-name")).to.equal(true, "should match sector-number styling");
    });

    // Interspace badges reference the sectors they border (e.g. "IS123"), not an arbitrary id.
    // Deep Space labels are now a bare number, not "DS<n>". Sectors 5/6/7 are always named with a
    // face-letter suffix ("5A"/"5B" etc, see map.ts) - lost-fleet-space-map at 2p includes
    // 5B/6B/7B, so this regression-tests that the letter never leaks into the "IS..." label
    // (digits only after "IS", per the naming convention).
    container.querySelectorAll('[data-sector-type="interspace"] text').forEach((badge) => {
      expect(badge.textContent.trim()).to.match(/^IS\d+$/);
    });
    deepSpaceLabels.forEach((label) => {
      expect(label.textContent.trim()).to.match(/^\d+$/);
    });
    expect(container.querySelectorAll("g.space-hex-cell .lost-fleet-spaceship").length).to.equal(spaceshipHexCount);
    // per-hex ship marker fills the whole hex with the ship's identity color (rulebook page 7:
    // Twilight purple / Rebellion brown / T F Mars grey / Eclipse yellow) plus a single bold,
    // centered letter - no separate orbit ring or "Ship" caption pill on top of it
    const mapShipMarker = container.querySelector("g.space-hex-cell .lost-fleet-spaceship");
    if (mapShipMarker) {
      expect(mapShipMarker.querySelector(".lost-fleet-spaceship__orbit")).to.equal(null);
      expect(mapShipMarker.querySelector(".lost-fleet-spaceship__pill")).to.equal(null);
      expect(mapShipMarker.querySelectorAll("text").length).to.equal(1);
      expect(mapShipMarker.querySelector("text").textContent).to.match(/^[TRME]$/);
      // the ship color fills the whole hex via a hex-shaped <use>, not a small circle
      const cell = mapShipMarker.closest("g.space-hex-cell");
      expect(cell.querySelector(".lost-fleet-spaceship__hex")).to.not.equal(null);
      expect(cell.querySelectorAll(".lost-fleet-spaceship circle").length).to.equal(0);
    }

    // the Lost Fleet legend (Interspace/Deep Space/Ship swatches) was removed entirely
    expect(container.querySelector('[data-kind="interspace"]')).to.equal(null);
    expect(container.querySelector('[data-kind="deep-space"]')).to.equal(null);
    expect(container.querySelector('[data-kind="ship"]')).to.equal(null);
  });

  it("centers each Deep Space label on its 3-hex tile's centroid, not pinned to a single hex", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    const byTile = new Map<string, GaiaHex[]>();
    for (const hex of engine.map.grid.values()) {
      if (classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace) {
        const id = hex.data.sector.split("_")[0];
        (byTile.get(id) ?? byTile.set(id, []).get(id)).push(hex);
      }
    }
    expect(byTile.size).to.be.greaterThan(0);

    for (const [id, hexes] of byTile) {
      expect(hexes.length).to.equal(3, `${id} should have all 3 of its hexes on a 2p board`);
      // every DS<id> label element exists with the bare numeric id (no "DS" prefix, no "_0" suffix)
      const labelForId = [...container.querySelectorAll('[data-sector-type="deep-space"]')].find(
        (el) => el.textContent.trim() === id.replace(/^DS/, "")
      );
      expect(labelForId, `expected a label for ${id}`).to.not.equal(undefined);
      const transform = labelForId.getAttribute("transform");
      const [tx, ty] = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(transform).slice(1).map(Number);
      // the centroid must not coincide with any single one of the tile's 3 hex centers (that was
      // the old per-hex-badge bug this replaces) - it should sit roughly between all 3.
      for (const hex of hexes) {
        const c = hexCenter(hex);
        const dist = Math.hypot(tx - c.x * 1.01, ty - c.y * 1.01);
        expect(dist, `${id} label should not sit on a single hex center`).to.be.greaterThan(0.1);
      }
    }
  });

  it("shows the 7 Tinkeroids/Moweyds terraforming-board colors as bordered squares, top-right of the map, only through round-1 setup", () => {
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
      expect(sq.getAttribute("stroke")).to.equal("#1a1a1a");
      expect(Number(sq.getAttribute("stroke-width"))).to.be.greaterThan(0);
      expect(sq.children.length).to.equal(0);
    });
    // deterministic from the seed via factions.ts's lostFleetTerraformingBoard()
    const colors = [...squares].map((sq) => sq.getAttribute("class").split(" ")[2]);
    expect(new Set(colors).size).to.equal(7); // all 7 distinct planet types, no repeats
  });

  it("hides the terraforming-board squares once round 1 begins", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    expect(engine.round).to.equal(0);
    // Force the round forward without a full legal replay - only `engine.round` is read by the
    // visibility check under test.
    engine.round = 1;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    expect(container.querySelectorAll("rect.lost-fleet-terraform-swatch").length).to.equal(0);
  });

  it("also hides the terraforming-board squares as soon as every seat has chosen a faction, even before round 1 starts", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    engine.players[0].faction = Faction.Tinkeroids;
    engine.players[1].faction = Faction.Terrans;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    expect(container.querySelectorAll("rect.lost-fleet-terraform-swatch").length).to.equal(0);
  });

  it("sizes the viewBox to contain every hex and keeps the wheel clear of hexes without reserving a full-height sidebar", () => {
    // The old hardcoded viewBox (-13 -11.5 26|33.5 24) clipped the taller Lost Fleet 3p/4p
    // layouts (top hexes at y=-16.5 / -19.1) and let the faction wheel sit on top of hexes.
    const transformXY = (el: Element | null): { x: number; y: number } => {
      const match = /translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(el?.getAttribute("transform") ?? "");
      expect(match, "expected an anchored transform").to.not.equal(null);
      return { x: Number(match[1]), y: Number(match[2]) };
    };

    // Lost Fleet boards are rotated (hex-grid-aligned) so the longest diagonal runs bottom-left to
    // top-right (SpaceMap.vue's mapRotationDeg): 3p is closest to that at 0deg, 2p/4p at 60deg.
    const rotationDeg = (players: number) => (players === 3 ? 0 : 60);
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
      const hexPoints: { x: number; y: number }[] = [];
      for (const hex of engine.map.grid.values()) {
        const raw = hexCenter(hex);
        const c = rotate(raw.x * 1.01, raw.y * 1.01, rotationDeg(players));
        expect(c.x - 1, `${players}p hex ${hex} left of viewBox`).to.be.gte(x);
        expect(c.x + 1, `${players}p hex ${hex} right of viewBox`).to.be.lte(x + w);
        expect(c.y - 1, `${players}p hex ${hex} above viewBox`).to.be.gte(y);
        expect(c.y + 1, `${players}p hex ${hex} below viewBox`).to.be.lte(y + h);
        hexPoints.push(c);
      }

      // The faction wheel only needs to stay clear of hexes within its own rendered band (it no
      // longer reserves a full-height sidebar the way the old flat 5.6-unit margin did - that's
      // the point of the fix: the map now uses whatever width the wheel isn't actually standing
      // on). Approximate the wheel's rendered footprint from its own known local content extents
      // (see the WHEEL_WIDTH/WHEEL_HEIGHT derivation comment in SpaceMap.vue) and assert no hex
      // (inflated by its own ~1-unit radius) intersects that rectangle. Read the actual scale from
      // the rendered transform too - 2p Lost Fleet renders the wheel smaller (SpaceMap.vue's
      // wheelScale), since its board has no natural pocket at any rotation to exploit.
      const wheelTransform = container.querySelector(".faction-wheel").getAttribute("transform") ?? "";
      const wheelOrigin = transformXY(container.querySelector(".faction-wheel"));
      const scaleMatch = /scale\((-?[\d.]+)\)/.exec(wheelTransform);
      expect(scaleMatch, "expected a scale(...) in the wheel transform").to.not.equal(null);
      const wheelScale = Number(scaleMatch[1]);
      const wheelBox = {
        left: wheelOrigin.x - 4 * wheelScale,
        // Lost Fleet's Asteroid/Protoplanet column sits to the right of the ring (FactionWheel.vue's
        // extraPlanetSlots), reaching local x = 6.1 - wider than the base-game ring alone.
        right: wheelOrigin.x + 6.1 * wheelScale,
        top: wheelOrigin.y - 4 * wheelScale,
        bottom: wheelOrigin.y + 7.6 * wheelScale,
      };
      for (const p of hexPoints) {
        const overlapsX = p.x + 1 > wheelBox.left && p.x - 1 < wheelBox.right;
        const overlapsY = p.y + 1 > wheelBox.top && p.y - 1 < wheelBox.bottom;
        expect(overlapsX && overlapsY, `${players}p wheel overlaps hex at (${p.x}, ${p.y})`).to.equal(false);
      }

      if (players === 2) {
        expect(x, "2p map should have equal left/right framing").to.be.closeTo(-(x + w), 1e-9);
        expect(w, "2p map viewBox should stay compact enough to maximize phone scale").to.be.lessThan(26.8);
      }
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

  it("renders Moweyds power rings as a full hex-border overlay so they stay visible around a PI", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    engine.players[0].faction = Faction.Moweyds;

    const targetHex = [...engine.map.grid.values()].find(
      (hex) => !hex.occupied() && hex.data.planet === Planet.Protoplanet
    );

    expect(targetHex, "need an unoccupied Protoplanet hex").to.not.equal(undefined);

    targetHex.data.building = Building.PlanetaryInstitute;
    targetHex.data.player = engine.players[0].player;
    targetHex.data.powerRing = engine.players[0].player;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    const moweydsHex = container.querySelector(`g.space-hex-cell[id="${targetHex}"]`);
    const ring = moweydsHex?.querySelector(".space-hex-power-ring.p");

    expect(ring).to.not.equal(null);
    expect(ring?.getAttribute("xlink:href") ?? ring?.getAttribute("href")).to.equal("#space-hex");
  });

  it("does not render final scoring on the map itself (it lives in ResearchBoard's 7th column instead)", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SpaceMap, { store });

    expect(container.querySelectorAll(".finalScoringTile").length).to.equal(0);
  });
});
