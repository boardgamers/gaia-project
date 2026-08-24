/* eslint-disable @typescript-eslint/camelcase */
import Engine, { Round } from "@gaia-project/engine";
import { createLocalVue, mount } from "@vue/test-utils";
import { expect } from "chai";
import Vuex from "vuex";
import { makeStore } from "../store";
import Pool from "./Pool.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function mountPool(inGame = false) {
  const store = makeStore();
  const engine = new Engine(["init 2 shared-panel-mode"], { lostFleet: true });
  engine.round = inGame ? Round.Round1 : Round.None;
  store.state.data = engine;
  return mount(Pool as any, {
    localVue,
    store,
    propsData: { compact: true },
    stubs: {
      Booster: { template: '<div class="booster-stub" />' },
      FederationTile: { template: '<div class="federation-stub" />' },
    },
  });
}

describe("compact Pool", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("keeps one extra tile gap below the federation grid instead of a double-height bottom margin", () => {
    const wrapper = mountPool(true);
    expect(wrapper.find(".pool-federations").attributes("data-bottom-clearance")).to.equal("single-gap");
    wrapper.destroy();
  });

  it("hides the federation grid before round 1", () => {
    const wrapper = mountPool(false);
    expect(wrapper.find(".pool-federations").exists()).to.equal(false);
    expect(wrapper.findAll(".booster-stub").length).to.be.greaterThan(0);
    wrapper.destroy();
  });
});
