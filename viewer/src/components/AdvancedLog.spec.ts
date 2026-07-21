import Engine from "@gaia-project/engine";
import { shallowMount } from "@vue/test-utils";
import { expect } from "chai";
import { makeStore } from "../store";
import AdvancedLog from "./AdvancedLog.vue";

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
