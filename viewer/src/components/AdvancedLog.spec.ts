import Engine, { AuctionVariant } from "@gaia-project/engine";
import { shallowMount } from "@vue/test-utils";
import { expect } from "chai";
import { makeStore } from "../store";
import AdvancedLog from "./AdvancedLog.vue";

describe("AdvancedLog during setup", () => {
  // Regression, owner-reported 2026-08-06: the whole log panel vanished during the round-0 ban
  // phase. A pre-faction move is logged under a seat slug ("p1 banFaction ambas"), which has no
  // entry in the faction color maps, and the resulting `undefined` color threw in rowStyle - taking
  // every row down with it, not just its own.
  it("renders moves made before anyone has a faction", () => {
    const engine = new Engine(["init 3 lf-msg7bnm9-ho4c", "p3 rotate", "p1 banFaction ambas"], {
      auction: AuctionVariant.PreferenceSplit,
      banPhase: true,
      lostFleet: true,
      advancedRules: true,
      officialCenterSectors: true,
    });
    const store = makeStore();
    store.commit("receiveData", engine);

    const text = shallowMount(AdvancedLog, { store }).text();

    expect(text).to.include("p1 banFaction ambas");
    expect(text).to.include("p3 rotate");
    expect(text).to.include("Game Started");
  });
});

describe("AdvancedLog theme surfaces", () => {
  it("uses semantic colors for neutral lifecycle rows", () => {
    const engine = new Engine(["init 2 dark-log-theme"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const wrapper = shallowMount(AdvancedLog, { store });
    const vm = wrapper.vm as any;

    expect(vm.rowStyle({ color: "white", textColor: "var(--res-power)" })).to.deep.equal({
      backgroundColor: "var(--ui-surface)",
      color: "var(--ui-log-accent)",
    });
    expect(vm.rowStyle({ color: "#f4cccc", textColor: "#412020" })).to.deep.equal({
      backgroundColor: "#f4cccc",
      color: "#412020",
    });
  });
});
