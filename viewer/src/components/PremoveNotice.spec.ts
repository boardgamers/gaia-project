import type { PremovePlan } from "@gaia-project/engine/src/premove-types";
import { mount } from "@vue/test-utils";
import { expect } from "chai";
import PremoveNotice from "./PremoveNotice.vue";

describe("premove notice dismissal", () => {
  const plan: PremovePlan = {
    moves: ["terrans up nav."],
    revision: 2,
    round: 1,
    requestId: "plan-1",
    notice: { kind: "played", text: "Played for you: terrans up terra." },
  };

  afterEach(() => window.localStorage.clear());

  it("persists dismissal across remounts without changing remaining premoves, but shows a new notice", async () => {
    const propsData = { plan: JSON.parse(JSON.stringify(plan)), storageKey: "notice:game-1:seat-0" };
    const wrapper = mount(PremoveNotice, { propsData });
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".premove-notice").exists()).to.equal(false);
    expect(propsData.plan).to.deep.equal(plan);
    wrapper.destroy();

    const refreshed = mount(PremoveNotice, { propsData });
    expect(refreshed.find(".premove-notice").exists()).to.equal(false);
    await refreshed.setProps({ plan: { ...plan, revision: 3 } });
    expect(refreshed.find(".premove-notice").exists()).to.equal(true);
    refreshed.destroy();
  });

  it("dismisses an unchanged notice after another real move and keeps it dismissed on reload", async () => {
    const propsData = { plan, storageKey: "notice:game-1:seat-0", moveHistory: "first position" };
    const wrapper = mount(PremoveNotice, { propsData });
    await wrapper.setProps({ moveHistory: "first position" });
    expect(wrapper.find(".premove-notice").exists()).to.equal(true);
    await wrapper.setProps({ moveHistory: "next position" });
    expect(wrapper.find(".premove-notice").exists()).to.equal(false);
    wrapper.destroy();
    const refreshed = mount(PremoveNotice, { propsData: { ...propsData, moveHistory: "next position" } });
    expect(refreshed.find(".premove-notice").exists()).to.equal(false);
    refreshed.destroy();
  });

  it("shows a new result arriving with a move, then clears it on later play", async () => {
    const wrapper = mount(PremoveNotice, {
      propsData: { plan, storageKey: "notice:game-1:seat-0", moveHistory: "first position" },
    });
    await wrapper.setProps({ plan: { ...plan, revision: 3 }, moveHistory: "next position" });
    expect(wrapper.find(".premove-notice").exists()).to.equal(true);
    await wrapper.setProps({ moveHistory: "later position" });
    expect(wrapper.find(".premove-notice").exists()).to.equal(false);
    wrapper.destroy();
  });

  it("can dismiss a stopped empty queue and isolates the dismissal by game and seat", async () => {
    const stopped: PremovePlan = {
      ...plan,
      moves: [],
      notice: { kind: "stopped", text: "Premoves stopped: booster4 is not in the available boosters" },
    };
    const wrapper = mount(PremoveNotice, {
      propsData: { plan: stopped, storageKey: "notice:game-1:seat-0" },
    });
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".premove-notice").exists()).to.equal(false);
    await wrapper.setProps({ storageKey: "notice:game-1:seat-1" });
    expect(wrapper.find(".premove-notice").exists()).to.equal(true);
    await wrapper.setProps({ storageKey: "notice:game-2:seat-0" });
    expect(wrapper.find(".premove-notice").exists()).to.equal(true);
    wrapper.destroy();
  });
});
