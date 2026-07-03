import Engine, { Faction, Spaceship } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import { factionPiecePlanet } from "../graphics/utils";
import LostFleetShips from "./LostFleetShips.vue";

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

    // each ship now spells out its full name on the board (not just the single-letter marker)
    const names = [...container.querySelectorAll(".lost-fleet-ship__name")].map((el) => el.textContent);
    expect(names).to.deep.equal(["Twilight", "Rebellion", "T F Mars", "Eclipse"]);

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

  it("has no fixed width/height on the ship svg, so it scales to fit its grid column (single row, scrolls on mobile)", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });

    const ship = container.querySelector("svg.lost-fleet-ship");
    expect(ship.hasAttribute("width")).to.equal(false);
    expect(ship.hasAttribute("height")).to.equal(false);
    expect(ship.getAttribute("viewBox")).to.equal("0 0 291 96");
  });

  it("lays the 4 exploration slots out in a single row with an ordinal label per slot", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const twilight = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Twilight}"]`);
    const slots = [1, 2, 3, 4].map((i) => twilight.querySelector(`[data-slot="${i}"]`));

    // 4 distinct x positions (one per column) but a single shared y position (one row)
    const transforms = slots.map((s) => s.getAttribute("transform"));
    expect(new Set(transforms).size).to.equal(4);
    const xs = new Set(transforms.map((t) => t.match(/translate\(([\d.]+),/)[1]));
    const ys = new Set(transforms.map((t) => t.match(/,\s*([\d.]+)\)/)[1]));
    expect(xs.size).to.equal(4);
    expect(ys.size).to.equal(1);

    // each slot shows its own ordinal (1st/2nd/3rd/4th slot), not just the power cost
    slots.forEach((slot, i) => {
      expect(slot.querySelector(".lost-fleet-ship__slot-ordinal").textContent).to.equal(String(i + 1));
    });
    // costs come from EXPLORATION_CHARGE_TRACK = [0, 2, 2, 4]; the 0-cost slot is a bare number,
    // non-zero slots show the same charge/power badge (Resource kind="pw") used everywhere else
    expect(slots[0].querySelector(".lost-fleet-ship__slot-cost").textContent).to.equal("0");
    expect(slots[0].querySelector("image")).to.equal(null);
    expect(slots.slice(1).map((s) => s.querySelector("g.resource text").textContent)).to.deep.equal(["2", "2", "4"]);
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

  it("draws Eclipse's free-mine-on-Asteroid action (6c) as a bigger planet bubble than other overlay icons", () => {
    const engine = new Engine(["init 2 lost-fleet-ships-spec"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShips, { store });
    const eclipse = container.querySelector(`svg.lost-fleet-ship[data-ship="${Spaceship.Eclipse}"]`);

    const mineBubbleCircle = eclipse.querySelector('[data-action="credit"] .lost-fleet-ship__action-overlay circle.planet-fill.a');
    expect(mineBubbleCircle).to.not.equal(null);
    expect(mineBubbleCircle.getAttribute("r")).to.equal("10");

    // other overlay icons (single-icon combos, no planet) go through the dampened, non-bubble path
    const powerOverlay = eclipse.querySelector('[data-action="power"] .lost-fleet-ship__action-overlay');
    expect(powerOverlay.querySelector("circle.planet-fill")).to.equal(null);
  });
});
