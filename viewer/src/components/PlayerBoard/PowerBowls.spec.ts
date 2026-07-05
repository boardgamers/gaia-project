import Engine, { Spaceship } from "@gaia-project/engine";
import Event from "@gaia-project/engine/src/events";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../../store";
import PowerBowls from "./PowerBowls.vue";

describe("PowerBowls", () => {
  it("shows a bowl III income indicator once the Power artifact's ongoing +2 income is loaded", () => {
    const engine = new Engine(["init 2 power-bowls-artifact", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.loadEvents(Event.parse(["+2ta3"], Spaceship.Twilight));

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PowerBowls, { props: { player }, store });

    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).to.include("+2");
  });

  it("does not show a bowl III income indicator without the artifact", () => {
    const engine = new Engine(["init 2 power-bowls-no-artifact", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PowerBowls, { props: { player }, store });

    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).to.not.include("+2");
  });
});
