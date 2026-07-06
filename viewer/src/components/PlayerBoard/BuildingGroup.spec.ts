import Engine from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../../store";
import BuildingGroup from "./BuildingGroup.vue";

describe("BuildingGroup", () => {
  it("does not render an available Gaiaformer token for one permanently consumed to colonize an Asteroid (Lost Fleet §E2)", () => {
    const engine = new Engine(["init 2 building-group-gf-asteroid", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.data.gaiaformers = 1;
    player.data.gaiaformersUsedForAsteroid = 1;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(BuildingGroup, {
      props: {
        nBuildings: player.data.gaiaformers,
        building: "gf",
        gaia: player.data.gaiaformersInGaia,
        player,
        placed: player.data.buildings.gf,
        asteroidConsumed: player.data.gaiaformersUsedForAsteroid,
        resource: [],
      },
      store,
    });

    expect(container.querySelector("g.building"), "the consumed Gaiaformer's slot should be empty, not available").to
      .equal(null);
  });

  it("still renders an available Gaiaformer token when one has not been used yet", () => {
    const engine = new Engine(["init 2 building-group-gf-available", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.data.gaiaformers = 1;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(BuildingGroup, {
      props: {
        nBuildings: player.data.gaiaformers,
        building: "gf",
        gaia: player.data.gaiaformersInGaia,
        player,
        placed: player.data.buildings.gf,
        asteroidConsumed: player.data.gaiaformersUsedForAsteroid,
        resource: [],
      },
      store,
    });

    expect(container.querySelector("g.building"), "the unused Gaiaformer should still render as available").to.not
      .equal(null);
  });
});
