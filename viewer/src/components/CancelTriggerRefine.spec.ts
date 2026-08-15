import Engine from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import { expect } from "chai";
import { makeStore } from "../store";
import CancelTriggerRefine from "./CancelTriggerRefine.vue";

const SETUP_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
];

function mountRefine(move: string) {
  const store = makeStore();
  store.commit("receiveData", new Engine(SETUP_MOVES));
  return mount(CancelTriggerRefine, {
    propsData: { move, watchedSeat: 0 },
    store,
  });
}

describe("CancelTriggerRefine", () => {
  it("pre-selects nothing on a multi-atom move", () => {
    const wrapper = mountRefine("terrans build lab 7A6. tech eco. up eco");
    try {
      const inner = wrapper.vm as any;
      expect(inner.candidates.length).to.be.greaterThan(1);
      expect(inner.selected.every((s: boolean) => s === false)).to.equal(true);
      expect(inner.armDisabled).to.equal(true);
    } finally {
      wrapper.destroy();
    }
  });

  it("pre-selects the single candidate on a one-atom move", () => {
    const wrapper = mountRefine("terrans pass booster3");
    try {
      const inner = wrapper.vm as any;
      expect(inner.candidates.length).to.equal(1);
      expect(inner.selected).to.deep.equal([true]);
      expect(inner.armDisabled).to.equal(false);
    } finally {
      wrapper.destroy();
    }
  });

  it("Arm is disabled until at least one atom is selected, then enabled", async () => {
    const wrapper = mountRefine("terrans build lab 7A6. tech eco. up eco");
    try {
      const inner = wrapper.vm as any;
      expect(inner.armDisabled).to.equal(true);
      inner.selected = [true, false, false];
      await wrapper.vm.$nextTick();
      expect(inner.armDisabled).to.equal(false);
    } finally {
      wrapper.destroy();
    }
  });

  it("toggling exact/any changes the stored atom for that selection", async () => {
    const wrapper = mountRefine("terrans build lab 7A6.");
    try {
      const inner = wrapper.vm as any;
      inner.selected = [true];
      await wrapper.vm.$nextTick();
      expect(inner.selectedAtoms).to.deep.equal(["build:lab:7A6"]);

      inner.loose = [true];
      await wrapper.vm.$nextTick();
      expect(inner.selectedAtoms).to.deep.equal(["build:lab:*"]);
    } finally {
      wrapper.destroy();
    }
  });

  it("emits arm with the selected atoms", async () => {
    const wrapper = mountRefine("terrans pass booster3");
    try {
      wrapper.find("button.btn-warning").trigger("click");
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted("arm")).to.deep.equal([[["pass:booster3"]]]);
    } finally {
      wrapper.destroy();
    }
  });
});
