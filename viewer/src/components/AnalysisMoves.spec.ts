import { mount } from "@vue/test-utils";
import { expect } from "chai";
import AnalysisMoves from "./AnalysisMoves.vue";

describe("AnalysisMoves prefix programming", () => {
  const propsData = {
    entries: [
      { kind: "move", move: "a" },
      { kind: "adjust", charge: 2 },
      { kind: "move", move: "b" },
      { kind: "move", move: "blocked" },
      { kind: "move", move: "suffix" },
    ],
    played: [{ move: "already played" }],
    appliedCount: 3,
    committableMoves: 2,
  };

  it("counts only remaining moves, with no programming control on played or adjustment rows", async () => {
    const wrapper = mount(AnalysisMoves, { propsData });
    const buttons = wrapper.findAll(".analysis-moves__program");
    expect(buttons.length).to.equal(4);
    expect(buttons.at(1).attributes("aria-label")).to.equal("Program up to move 3");
    expect(wrapper.find(".analysis-moves__past button").exists()).to.equal(false);
    await buttons.at(1).trigger("click");
    expect(wrapper.emitted("commit")).to.deep.equal([[2]]);
    await buttons.at(2).trigger("click");
    await buttons.at(3).trigger("click");
    expect(wrapper.emitted("commit")).to.have.length(1);
    // Existing edit and delete events still carry entry indices, not move counts.
    await wrapper.findAll(".analysis-moves__move").at(1).trigger("click");
    await wrapper.findAll(".analysis-moves__remove").at(2).trigger("click");
    expect(wrapper.emitted("edit")).to.deep.equal([[2]]);
    expect(wrapper.emitted("remove")).to.deep.equal([[2]]);
    wrapper.destroy();
  });

  it("disables simulated but uncommittable endpoints and all controls during an unfinished move", async () => {
    const wrapper = mount(AnalysisMoves, { propsData: { ...propsData, appliedCount: 5, committableMoves: 1 } });
    expect(wrapper.findAll(".analysis-moves__program").at(1).attributes("disabled")).to.equal("disabled");
    await wrapper.setProps({ disabled: true });
    await wrapper.find(".analysis-moves__program").trigger("click");
    expect(wrapper.emitted("commit")).to.equal(undefined);
    wrapper.destroy();
  });
});
