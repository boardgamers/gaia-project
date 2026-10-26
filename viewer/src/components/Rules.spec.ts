import Engine, { Faction } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import Vue from "vue";
import { makeStore } from "../store";
import Rules from "./Rules.vue";

Vue.use(BootstrapVue);

describe("faction help selection", () => {
  it("follows a reused board's faction and reopens on the clicked faction after browsing another sheet", async () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(["init 4 faction-help"], { lostFleet: true }));
    const view = mount(Rules, {
      store,
      propsData: { id: Faction.Darkanians, type: Faction.Darkanians },
      stubs: {
        BModal: { name: "BModal", template: "<div><slot /></div>", props: ["id"] },
        FactionInfoCard: { template: '<div class="sheet">{{ faction }}</div>', props: ["faction"] },
      },
    });
    try {
      await Vue.nextTick();
      expect(view.find("h4").text()).toBe("Darkanians");
      await view.setProps({ id: Faction.Terrans, type: Faction.Terrans });
      expect(view.find("h4").text()).toBe("Terrans");
      expect(view.find(".sheet").text()).toBe("terrans");
      (view.vm as any).selectRule(Faction.Darkanians);
      await Vue.nextTick();
      expect(view.find("h4").text()).toBe("Darkanians");
      view.findComponent({ name: "BModal" }).vm.$emit("show");
      await Vue.nextTick();
      expect(view.find("h4").text()).toBe("Terrans");
      expect(view.find(".sheet").text()).toBe("terrans");
    } finally {
      view.destroy();
    }
  });
});
