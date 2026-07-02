import Engine, { Spaceship } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
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
    expect(container.querySelector(".spaceship-title")).to.equal(null);

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
});
