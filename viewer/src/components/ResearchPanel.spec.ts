import { createLocalVue, mount } from "@vue/test-utils";
import { expect } from "chai";
import Vuex from "vuex";
import ResearchPanel from "./ResearchPanel.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function mountPanel() {
  const store = new Vuex.Store({ state: { seatUsers: {}, data: { players: [] } } });
  return mount(ResearchPanel as any, {
    localVue,
    store,
    slots: { default: '<svg class="scoring-research-board" />' },
  });
}

describe("ResearchPanel", () => {
  it("renders the research board slot", () => {
    const wrapper = mountPanel();
    expect(wrapper.find(".scoring-research-board").exists()).to.equal(true);
    wrapper.destroy();
  });
});
