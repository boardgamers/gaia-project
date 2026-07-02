import Engine from "@gaia-project/engine";
import { Spaceship, SpaceshipFederation, SpaceshipTechTile } from "@gaia-project/engine/src/enums";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import PlayerInfo from "./PlayerInfo.vue";

describe("PlayerInfo terraforming strip", () => {
  it("keeps the default full-size markers for base factions", () => {
    const engine = new Engine(["init 2 player-info-base", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });

    const stepOneMarkers = container.querySelectorAll('[data-terraforming-step="1"]');
    expect(stepOneMarkers.length).to.equal(2);
    stepOneMarkers.forEach((marker) => {
      expect(marker.getAttribute("data-radius")).to.equal("1");
    });
  });

  it("shows resolved 1-step and 3-step planets for Tinkeroids using compact markers", () => {
    const engine = new Engine(
      [
        "init 3 player-info-lost-fleet",
        "p1 faction tinkeroids",
        "p2 faction bescods",
        "p3 faction moweyds",
      ],
      { lostFleet: true }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const cost3Planets = engine.players[0].data.lostFleetCost3Planets;

    expect(container.querySelectorAll('[data-terraforming-step="1"]').length).to.equal(4);
    expect(container.querySelectorAll('[data-terraforming-step="3"]').length).to.equal(3);

    cost3Planets.forEach((planet) => {
      expect(container.querySelector(`[data-terraforming-step="3"][data-planet="${planet}"]`)).to.not.equal(null);
      expect(container.querySelector(`[data-terraforming-step="1"][data-planet="${planet}"]`)).to.equal(null);
    });

    container.querySelectorAll('[data-terraforming-step="1"]').forEach((marker) => {
      expect(Number(marker.getAttribute("data-radius"))).to.be.lessThan(1);
    });
  });

  it("renders claimed Lost Fleet ship tech tiles on the player board", () => {
    const engine = new Engine(["init 2 player-info-ship-tech", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });

    engine.players[0].data.tiles.techs.push({
      tile: SpaceshipTechTile.Resource,
      pos: Spaceship.Rebellion,
      enabled: true,
    });

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const shipTech = container.querySelector<SVGElement>("svg.techTile.rebellion");

    expect(shipTech).to.not.equal(null);
    // renders through TechContent's icon system (o + 3k resource icons), not the old text fallback
    expect(shipTech?.querySelector("rect.ore")).to.not.equal(null);
    expect(shipTech?.textContent).to.contain("3");
    expect(shipTech?.textContent).to.not.contain("1o3k");
  });

  it("renders claimed Lost Fleet ship Federation tokens with the base-game token art", () => {
    const engine = new Engine(["init 2 player-info-ship-fed", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });

    engine.players[0].data.spaceshipFederations.push({ tile: SpaceshipFederation.Credit, green: true });

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const shipFed = container.querySelector(`[data-ship-federation="${SpaceshipFederation.Credit}"]`);

    expect(shipFed, "claimed ship Federation token should render in the tiles row").to.not.equal(null);
    expect(shipFed?.querySelector("image")).to.not.equal(null);
  });
});
