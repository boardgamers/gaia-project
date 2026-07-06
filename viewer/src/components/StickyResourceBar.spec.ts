import Engine, { ResearchField } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import StickyResourceBar from "./StickyResourceBar.vue";

describe("StickyResourceBar", () => {
  it("shows victory points, sector count, federation count, and a pip per research track", () => {
    const engine = new Engine(["init 2 sticky-resource-bar-spec", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.data.victoryPoints = 13;
    player.data.research[ResearchField.Science] = 3;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(StickyResourceBar, { props: { player }, store });

    const texts = Array.from(container.querySelectorAll(".sticky-resource-bar__count")).map((t) => t.textContent);
    expect(texts).to.include("3");

    expect(container.querySelector(".sticky-resource-bar__research").children.length).to.equal(
      ResearchField.values(engine.expansions).length
    );
  });
});
