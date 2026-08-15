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
      expect(inner.selectedAtoms).to.deep.equal([]);
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
      expect(inner.selectedAtoms).to.deep.equal(["pass:booster3"]);
    } finally {
      wrapper.destroy();
    }
  });

  // The host sheet's footer disables "Arm rule" on exactly an empty selection, so what this asserts
  // is that the empty->non-empty transition is reported upward at all.
  it("reports the selection upward as it changes, so the sheet's Arm button can follow it", async () => {
    const wrapper = mountRefine("terrans build lab 7A6. tech eco. up eco");
    try {
      const inner = wrapper.vm as any;
      expect(wrapper.emitted("input")).to.deep.equal([[[]]]);

      inner.selected = [true, false, false];
      await wrapper.vm.$nextTick();
      expect(inner.selectedAtoms.length).to.equal(1);
      expect(wrapper.emitted("input")!.slice(-1)).to.deep.equal([[["build:lab:7A6"]]]);
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

  // The component no longer draws its own Arm/Cancel pair - the sheet that hosts it owns the footer,
  // so every step of the flow confirms from the same place. Its contract is the `input` it reports.
  it("emits the pre-selected atom on mount, without an Arm button of its own", async () => {
    const wrapper = mountRefine("terrans pass booster3");
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted("input")).to.deep.equal([[["pass:booster3"]]]);
      expect(wrapper.find("button.btn-warning").exists()).to.equal(false);
    } finally {
      wrapper.destroy();
    }
  });
});
