import Engine, { Faction, Spaceship } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import { factionPiecePlanet } from "../graphics/utils";
import LostFleetShips from "./LostFleetShips.vue";
import TechContent from "./TechContent.vue";

// SpecialAction.vue's template uses <TechContent> without a local import, relying on launcher.ts's
// global Vue.component("TechContent", ...) registration - which isolated component tests never
// load. Register it the same way here so board-action octagons (SpecialAction) fully resolve their
// icon content instead of leaving an unrendered <TechContent> custom element in the DOM.
Vue.component("TechContent", TechContent);

// Renders the real consolidated per-ship overview strip against real Lost Fleet engines,
// following the render-path testing convention from PERFORMANCE.md / SpaceMap.spec.ts:
// everything a ship gives access to (actions, Federation token, Standard Tech, artifacts,
// explored-by markers) must be visible in one place, drawn with base-game components.
describe("LostFleetShips", () => {
  it("shows actions, Federation token, tech tile, and artifacts per ship using base-game components", () => {
    const engine = new Engine(["init 4 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });

    const ships = container.querySelectorAll("svg.lost-fleet-ship");
    expect(ships.length).to.equal(4);

    // 3 board actions per ship, each drawn with the base game's SpecialAction octagon
    expect(container.querySelectorAll("[data-action]").length).to.equal(12);
    expect(container.querySelectorAll("[data-action] g.specialAction > polygon").length).to.equal(12);

    // every seeded Federation token renders the real base-game token art (federation.svg image)
    const seededFederations = Object.keys(engine.tiles.spaceshipFederations).length;
    expect(seededFederations).to.be.greaterThan(0);
    // direct child only: reward icons inside the token may themselves contain <image> elements
    expect(container.querySelectorAll('[data-section="federation"] g.federationTile > image').length).to.equal(
      seededFederations
    );

    // ships with a Standard Tech slot show a real TechTile rendering icons, not the old text fallback
    expect(container.querySelectorAll('[data-section="tech"] svg.techTile').length).to.equal(3);

    // the ship name text was dropped - the single-letter marker circle is enough, freeing the
    // header row for 5 same-size circles (marker + 4 exploration slots) in a row
    expect(container.querySelectorAll(".lost-fleet-ship__name").length).to.equal(0);

    // Twilight carries the seeded artifact tokens (one per player at 4p)
    expect(engine.tiles.artifacts.length).to.equal(4);
    expect(container.querySelectorAll("[data-artifact]").length).to.equal(4);

    // build-bypass actions with empty engine effect arrays still show an icon overlay
    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);
    expect(twilight.querySelector('[data-action="power"] .lost-fleet-ship__action-overlay')).to.not.equal(null);

    // 4 exploration slots per ship, all open (no tokens yet)
    expect(twilight.querySelectorAll("[data-slot]").length).to.equal(4);
    expect(twilight.querySelector("[data-slot] .player-token")).to.equal(null);
  });

  it("marks explored-by players with faction tokens and used actions with an X", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    engine.players[0].data.explorationShips[Spaceship.Twilight] = 1;
    engine.spaceshipActions[Spaceship.Twilight] = { qic: engine.players[0].player };

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });

    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);
    expect(twilight.querySelector('[data-slot="1"] .player-token')).to.not.equal(null);
    expect(twilight.querySelector('[data-slot="2"] .player-token')).to.equal(null);

    const usedAction = twilight.querySelector('[data-action="qic"]');
    expect(usedAction.classList.contains("used")).to.equal(true);
    expect(usedAction.querySelectorAll("line").length).to.equal(2);

    const readyAction = twilight.querySelector('[data-action="knowledge"]');
    expect(readyAction.classList.contains("used")).to.equal(false);
    expect(readyAction.querySelectorAll("line").length).to.equal(0);
  });

  it("excludes Rebellion in 2-player games", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });

    expect(container.querySelectorAll("svg.lost-fleet-ship").length).to.equal(3);
    expect(container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Rebellion}"]`)).to.equal(null);
  });

  it("has no fixed width/height on the ship svg, so it scales to fit its 2x2 grid column", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });

    const ship = container.querySelector("svg.lost-fleet-ship");
    expect(ship.hasAttribute("width")).to.equal(false);
    expect(ship.hasAttribute("height")).to.equal(false);
    expect(ship.getAttribute("viewBox")).to.equal("0 0 291 76");
  });

  it("lays the ship marker + 4 exploration slots out as 5 evenly-spaced circles in a single row", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);
    const slots = [1, 2, 3, 4].map((i) => twilight.querySelector(`[data-slot="${i}"]`));

    // 4 distinct x positions (one per column) but a single shared y position (one row)
    const transforms = slots.map((s) => s.getAttribute("transform"));
    expect(new Set(transforms).size).to.equal(4);
    const xs = [...transforms.map((t) => Number(t.match(/translate\(([\d.]+),/)[1]))];
    const ys = new Set(transforms.map((t) => t.match(/,\s*([\d.]+)\)/)[1]));
    expect(new Set(xs).size).to.equal(4);
    expect(ys.size).to.equal(1);

    // evenly spaced 20 apart, same spacing as the gap from the marker circle (cx=9) to slot 1 -
    // i.e. 5 same-size circles (marker + 4 slots) in one evenly-spaced row, no per-slot ordinal
    // number (removed - the power-charge badge is the only number shown per slot).
    const sortedXs = xs.slice().sort((a, b) => a - b);
    for (let i = 1; i < sortedXs.length; i++) {
      expect(sortedXs[i] - sortedXs[i - 1]).to.equal(20);
    }
    expect(sortedXs[0] - 9).to.equal(20);
    slots.forEach((slot) => {
      expect(slot.querySelector(".lost-fleet-ship__slot-ordinal")).to.equal(null);
    });
    // costs come from EXPLORATION_CHARGE_TRACK = [0, 2, 2, 3]; the free (0-cost) slot shows no
    // number at all, non-zero slots show the same charge/power badge (Resource kind="pw") used
    // everywhere else
    expect(slots[0].querySelector(".lost-fleet-ship__slot-cost")).to.equal(null);
    expect(slots[0].querySelector("image")).to.equal(null);
    expect(slots.slice(1).map((s) => s.querySelector("g.resource text").textContent)).to.deep.equal(["2", "2", "3"]);
    expect(slots[1].querySelector("image")).to.not.equal(null);
  });

  it("colors a taken ship action by the acting player's faction, like base-game BoardAction", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    engine.spaceshipActions[Spaceship.Twilight] = { qic: engine.players[0].player };

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);

    const takenPolygon = twilight.querySelector('[data-action="qic"] g.specialAction > polygon');
    const planet = factionPiecePlanet(Faction.Terrans);
    expect(takenPolygon.classList.contains("planet-fill")).to.equal(true);
    expect(takenPolygon.classList.contains(planet)).to.equal(true);

    // an untaken action stays the neutral board-action fill (no planet-fill class)
    const readyPolygon = twilight.querySelector('[data-action="knowledge"] g.specialAction > polygon');
    expect(readyPolygon.classList.contains("planet-fill")).to.equal(false);
  });

  it("keeps Twilight's artifact grid centered on the tech-tile slot and within the ship's own viewBox", () => {
    const engine = new Engine(["init 4 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);

    // 4 artifacts at 4p -> a full 2x2 grid
    const artifactGroups = twilight.querySelectorAll("[data-artifact]");
    expect(artifactGroups.length).to.equal(4);

    // ArtifactIcon is rendered at size=28 here (down from its native 30, so the 30-unit grid
    // repeat below no longer overlaps consecutive icons) - a self-contained nested <svg> whose
    // visual center sits 14 (half of 28) screen units right/down of whatever translate positions
    // it. Every icon's true on-screen center must land in roughly the same region the other 3
    // ships' Standard Tech tile occupies, bottom-aligned with the action octagons like that slot
    // (see the template comment by this grid), and no icon may render past the ship's own 76-tall
    // viewBox (the reported "bleeds into the bottom" bug).
    const iconHalfSize = 14;
    const centers = Array.from(artifactGroups).map((g) => {
      const [, x, y] = g.getAttribute("transform")!.match(/translate\(([\d.]+),\s*([\d.]+)\)/)!;
      return { x: Number(x) + iconHalfSize, y: Number(y) + iconHalfSize };
    });
    const avgX = centers.reduce((s, c) => s + c.x, 0) / centers.length;
    const avgY = centers.reduce((s, c) => s + c.y, 0) / centers.length;
    expect(avgX).to.be.closeTo(251, 5);
    expect(avgY).to.be.closeTo(38, 5);

    for (const c of centers) {
      expect(c.y + iconHalfSize).to.be.at.most(76);
    }
  });

  it("does not let Twilight's artifact icons overlap each other (a 28-wide icon in a 30-unit grid repeat)", () => {
    const engine = new Engine(["init 4 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);
    const icons = twilight.querySelectorAll("[data-artifact] > svg");

    expect(icons.length).to.equal(4);
    for (const icon of Array.from(icons)) {
      expect(icon.getAttribute("width")).to.equal("28");
      expect(icon.getAttribute("height")).to.equal("28");
    }
  });

  it("draws Eclipse's free-mine-on-Asteroid action (6c) as a bigger planet bubble than other overlay icons", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const eclipse = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Eclipse}"]`);

    const mineBubbleCircle = eclipse.querySelector(
      '[data-action="credit"] .lost-fleet-ship__action-overlay circle.planet-fill.a'
    );
    expect(mineBubbleCircle).to.not.equal(null);
    expect(mineBubbleCircle.getAttribute("r")).to.equal("10");

    // other overlay icons (single-icon combos, no planet) go through the dampened, non-bubble path
    const powerOverlay = eclipse.querySelector('[data-action="power"] .lost-fleet-ship__action-overlay');
    expect(powerOverlay.querySelector("circle.planet-fill")).to.equal(null);
  });

  it("shows T F Mars's 'VP per tech tile' QIC action with the tech tile icon, not raw 'tt' text", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const tfMars = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.TFMars}"]`);
    const qicAction = tfMars.querySelector('[data-action="qic"]');

    expect(qicAction.querySelector("image"), "expected the tech tile Resource icon (an <image>)").to.not.equal(null);
    expect(qicAction.textContent).to.not.contain("tt");
  });
});
