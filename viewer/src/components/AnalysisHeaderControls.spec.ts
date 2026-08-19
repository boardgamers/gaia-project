import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import AnalysisHeaderControls from "./AnalysisHeaderControls.vue";

Vue.use(BootstrapVue);

// Analysis mode's entire control surface after §12 dissolved the yellow panel into the striped
// header. Rendered twice per page (desktop title + mobile sticky bar), which is why the info MODAL
// deliberately lives elsewhere - see AnalysisModeInfo.vue and the Commands.vue spec.
describe("AnalysisHeaderControls", () => {
  const controls = (props: Record<string, unknown> = {}) =>
    render(AnalysisHeaderControls, { props: { moveCount: 0, ...props } });

  function button(container: HTMLElement, label: string): HTMLButtonElement {
    return Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes(label)
    ) as HTMLButtonElement;
  }

  it("counts the line, in singular and plural", () => {
    expect(controls({ moveCount: 1 }).container.textContent).to.contain("1 move");
    expect(controls({ moveCount: 3 }).container.textContent).to.contain("3 moves");
  });

  it("shows nothing about resources while the line stays affordable - the player board has them", () => {
    const { container } = controls({ moveCount: 2, status: { overdrawn: [], assumedPower: 0 } });
    expect(container.querySelector(".analysis-controls__overdrawn")).to.equal(null);
    expect(container.querySelector(".analysis-controls__assumed")).to.equal(null);
  });

  it("summarises an overdraft, since the board scrolls off screen on mobile", () => {
    const { container } = controls({
      moveCount: 2,
      status: {
        overdrawn: [
          { kind: "c", amount: -7 },
          { kind: "o", amount: -1 },
        ],
        assumedPower: 0,
      },
    });
    expect(container.querySelector(".analysis-controls__overdrawn").textContent.replace(/\s+/g, "")).to.equal("-7c-1o");
  });

  it("reports power the sandbox assumed was charged", () => {
    const { container } = controls({ moveCount: 1, status: { overdrawn: [], assumedPower: 3 } });
    expect(container.querySelector(".analysis-controls__assumed").textContent).to.contain("+3 power");
  });

  it("keeps a running total of the Charge 1 presses, separately from the topped-up power", () => {
    // The two are different fictions - one the player asked for, one the sandbox did on its own - so
    // they get their own chips rather than being added together into one number.
    const { container } = controls({ moveCount: 2, status: { overdrawn: [], assumedPower: 3, chargedPower: 2 } });
    expect(container.querySelector(".analysis-controls__charged").textContent).to.contain("+2 charged");
    expect(container.querySelector(".analysis-controls__assumed").textContent).to.contain("+3 power");

    const none = controls({ moveCount: 2, status: { overdrawn: [], assumedPower: 0, chargedPower: 0 } });
    expect(none.container.querySelector(".analysis-controls__charged")).to.equal(null);
  });

  it("no longer carries Undo/Reset - they are map-corner icons beside the sandbox toggle now", () => {
    const { container } = controls({ moveCount: 2 });
    expect(button(container, "Undo")).to.equal(undefined);
    expect(button(container, "Reset")).to.equal(undefined);
  });

  it("only offers Commit once there is a line, and disables it while nothing in it is committable", async () => {
    expect(button(controls({ moveCount: 0 }).container, "Commit")).to.equal(undefined);
    expect(button(controls({ moveCount: 2, committableMoves: 0 }).container, "Commit").disabled).to.equal(true);

    const { container, emitted } = controls({ moveCount: 2, committableMoves: 2 });
    const commit = button(container, "Commit");
    expect(commit.disabled).to.equal(false);

    await fireEvent.click(commit);

    expect(emitted().commit).to.have.length(1);
  });

  it("offers the info button that opens the shared explainer modal", () => {
    const { container } = controls({ moveCount: 1 });
    expect(container.querySelector(".analysis-controls__info")).to.not.equal(null);
    // The modal itself is rendered once by Commands.vue, never here.
    expect(container.querySelector("#analysis-mode-info")).to.equal(null);
  });
});
