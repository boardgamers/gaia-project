import Engine, { Expansion, Faction } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import FactionInfoCard from "./FactionInfoCard.vue";

describe("FactionInfoCard", () => {
  it("renders every field the old HTML-string popup showed, for a base-game faction", () => {
    const engine = new Engine(["init 2 faction-info-base"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Terrans, variant: null, expansion: engine.expansions },
      store,
    });

    expect(container.textContent).to.include(
      "During the Gaia phase, move the power tokens in your Gaia area to area II"
    );
    expect(container.textContent).to.include(
      "During the Gaia phase, when you move power tokens from your Gaia area to area II"
    );
    // No Lost Fleet section for a plain base-game render.
    expect(container.textContent).to.not.include("Lost Fleet changes");
    // Real icon components rendered (not the old text-badge HTML), one per building slot.
    expect(container.querySelectorAll(".faction-board-preview__building").length).to.equal(6);
    expect(container.querySelectorAll("g.resource").length).to.be.greaterThan(0);
  });

  it("includes the Lost Fleet changes section for a faction with a Lost Fleet delta, under the expansion", () => {
    const engine = new Engine(["init 2 faction-info-lf"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Darkanians, variant: null, expansion: Expansion.LostFleet },
      store,
    });

    expect(container.textContent).to.include("Lost Fleet changes");
    expect(container.textContent).to.include("standard planets always terraform in 1 step");
  });
});
