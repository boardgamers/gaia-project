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
    await wrapper.findAll(".analysis-moves__edit").at(1).trigger("click");
    await wrapper.findAll(".analysis-moves__remove").at(2).trigger("click");
    expect(wrapper.emitted("edit")).to.deep.equal([[2]]);
    expect(wrapper.emitted("remove")).to.deep.equal([[2]]);
    wrapper.destroy();
  });

  it("keeps the whole plan visible, highlights the inspected step and separates viewing from editing", async () => {
    const wrapper = mount(AnalysisMoves, {
      propsData: { ...propsData, activeIndex: 2, inspecting: true, mutationsDisabled: true },
    });
    expect(wrapper.findAll(".analysis-moves__row")).to.have.length(5);
    expect(wrapper.findAll(".analysis-moves__past")).to.have.length(1);
    expect(wrapper.findAll(".analysis-moves__row--selected")).to.have.length(1);
    expect(wrapper.find('[aria-current="step"]').text()).to.contain("b");
    expect(wrapper.find(".analysis-moves__selected-state").text()).to.equal("Viewing");
    const moves = wrapper.findAll(".analysis-moves__move");
    expect(moves.at(1).attributes("aria-label")).to.equal("View after move 3: b");
    await moves.at(0).trigger("click");
    await moves.at(1).trigger("click");
    expect(wrapper.emitted("inspect")).to.deep.equal([[0], [2]]);
    expect(wrapper.emitted("edit")).to.equal(undefined);
    await wrapper.findAll(".analysis-moves__edit").at(1).trigger("click");
    expect(wrapper.emitted("edit")).to.deep.equal([[2]]);
    await wrapper.find(".analysis-moves__remove").trigger("click");
    await wrapper.find(".analysis-moves__program").trigger("click");
    expect(wrapper.emitted("remove")).to.equal(undefined);
    expect(wrapper.emitted("commit")).to.equal(undefined);
    // A blocked move can be repaired, but its after-position does not exist yet.
    await moves.at(2).trigger("click");
    await wrapper.findAll(".analysis-moves__edit").at(2).trigger("click");
    expect(wrapper.emitted("inspect")).to.have.length(2);
    expect(wrapper.emitted("edit")).to.deep.equal([[2], [3]]);
    wrapper.destroy();
  });

  it("highlights editing and insertion without hiding the remaining rows", async () => {
    const wrapper = mount(AnalysisMoves, { propsData: { ...propsData, activeIndex: 0 } });
    expect(wrapper.find(".analysis-moves__selected-state").text()).to.equal("Editing");
    expect(wrapper.findAll(".analysis-moves__row")).to.have.length(5);
    await wrapper.setProps({ inserting: true, activeIndex: 2 });
    expect(wrapper.find(".analysis-moves__row--selected").exists()).to.equal(false);
    expect(wrapper.find(".analysis-moves__insert--selected").attributes("aria-label")).to.equal("Insert before move 3");
    await wrapper.setProps({ disabled: true });
    await wrapper.find(".analysis-moves__move").trigger("click");
    await wrapper.find(".analysis-moves__edit").trigger("click");
    expect(wrapper.emitted("inspect")).to.equal(undefined);
    expect(wrapper.emitted("edit")).to.equal(undefined);
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
