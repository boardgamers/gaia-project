import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import AnalysisPanel from "./AnalysisPanel.vue";

Vue.use(BootstrapVue);

// Ordinary board changes are reflected in the plan rows, never a top notice. This component is
// solely the inline rollback/divergence recovery prompt beside Commands.vue's plan list.
describe("AnalysisPanel", () => {
  it("renders nothing when there is no saved plan awaiting recovery", () => {
    const { container } = render(AnalysisPanel, { props: { active: true } });
    expect(container.querySelector(".analysis-restore")).to.equal(null);
    expect(container.querySelector(".analysis-strip, [role='alert'], button")).to.equal(null);
  });

  it("offers only restore or discard, with no generic notice or dismiss button", async () => {
    const pendingRestore = {
      lines: [[{ kind: "move", move: "terrans up nav." }]],
      active: 0,
      baseMoveCount: 9,
    };
    const { container, emitted } = render(AnalysisPanel, { props: { active: true, pendingRestore } });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent.trim())).to.deep.equal(["Restore anyway", "Discard"]);
    expect(container.querySelector(".analysis-restore").textContent).to.contain("1 move");
    expect(container.querySelector(".analysis-strip, [role='alert']")).to.equal(null);

    await fireEvent.click(buttons[0]);
    await fireEvent.click(buttons[1]);

    expect(emitted().restore).to.have.length(1);
    expect(emitted()["discard-restore"]).to.have.length(1);
  });

  // Restore/Discard answers for every stored line at once, so quoting only the open line's length
  // would understate what Discard is about to throw away.
  it("counts every line and every move when more than one was stored", () => {
    const pendingRestore = {
      lines: [[{ kind: "move", move: "terrans up nav." }], [{ kind: "move", move: "terrans up gaia." }], []],
      active: 1,
      baseMoveCount: 9,
    };
    const { container } = render(AnalysisPanel, { props: { active: true, pendingRestore } });
    const text = container.querySelector(".analysis-restore").textContent;
    expect(text).to.contain("3 saved plans");
    expect(text).to.contain("2 moves in total");
  });

  it("renders nothing while analysis mode is inactive, even with a pending recovery", () => {
    const pendingRestore = {
      lines: [[{ kind: "move", move: "terrans up nav." }]],
      active: 0,
      baseMoveCount: 9,
    };
    const { container } = render(AnalysisPanel, { props: { active: false, pendingRestore } });
    expect(container.querySelector(".analysis-restore, .analysis-strip, button")).to.equal(null);
  });
});
