import Engine, { Expansion, Faction } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import FactionInfoCard from "./FactionInfoCard.vue";

describe("FactionInfoCard", () => {
  it("renders the reused in-game faction board plus the explore cost, for a base-game faction", () => {
    const engine = new Engine(["init 2 faction-info-base"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Terrans, variant: null, expansion: engine.expansions },
      store,
    });

    // The actual in-game board component is reused (its root svg carries the .player-board class).
    expect(container.querySelector(".player-board")).to.not.equal(null);
    // Explore cost is always shown.
    expect(container.textContent).to.include("Explore");
    // Abilities remain in the DOM (behind a collapse toggle).
    expect(container.textContent).to.include(
      "During the Gaia phase, move the power tokens in your Gaia area to area II"
    );
    // No Lost Fleet section for a plain base-game render.
    expect(container.textContent).to.not.include("Lost Fleet changes");
  });

  it("shows the Lost Fleet changes section only for a base faction with a real Lost Fleet delta", () => {
    const engine = new Engine(["init 2 faction-info-lf"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Gleens, variant: null, expansion: Expansion.LostFleet },
      store,
    });

    expect(container.textContent).to.include("Lost Fleet changes");
    expect(container.textContent).to.include("+2 range");
  });

  it("omits the Lost Fleet changes section for an expansion-native faction, showing a starting-setup note instead", () => {
    const engine = new Engine(["init 2 faction-info-exp"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Darkanians, variant: null, expansion: Expansion.LostFleet },
      store,
    });

    expect(container.textContent).to.not.include("Lost Fleet changes");
    expect(container.textContent).to.include("Places only one starting mine");
    // The expansion factions place in their own setup stage after the base-game factions.
    expect(container.textContent).to.include("expansion-faction setup stage");
  });

  it("shows the per-round Tinkering tiles for Tinkeroids", () => {
    const engine = new Engine(["init 2 faction-info-tink"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Tinkeroids, variant: null, expansion: Expansion.LostFleet },
      store,
    });

    expect(container.textContent).to.include("Tinkering tiles");
    expect(container.textContent).to.include("Rounds 1-3");
    expect(container.textContent).to.include("Rounds 4-6");
  });

  it("renders Lantids without throwing (its filler opponent must not also be Terrans, its opposite faction)", () => {
    const engine = new Engine(["init 2 faction-info-lantids"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Lantids, variant: null, expansion: engine.expansions },
      store,
    });

    expect(container.textContent).to.include("build a mine on a planet colonized by an opponent");
  });
  it("refreshes both the modal costs and its player board when another faction is chosen", async () => {
    const engine = new Engine(["init 3 live-terraform-preview"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);
    const { container } = render(FactionInfoCard, {
      props: { faction: Faction.Moweyds, variant: null, expansion: Expansion.LostFleet },
      store,
    });
    const before = container.querySelector(".player-board")!.outerHTML;
    const next = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    next.move("p1 faction nevlas");
    store.commit("receiveData", next);
    await Vue.nextTick();
    await Vue.nextTick();
    expect(container.querySelectorAll(".faction-info-card__swatch--cost3").length).to.equal(3);
    const white = next.lostFleetTerraformingRow.indexOf("i" as any);
    expect(container.querySelectorAll(".faction-info-card__swatch")[white].textContent!.trim()).to.equal("3");
    expect(container.querySelector(".player-board")!.outerHTML).not.to.equal(before);
  });
});
