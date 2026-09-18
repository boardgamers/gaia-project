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

  it("shows plan deltas rather than the negative balance, with a separate shortfall warning", () => {
    const { container } = controls({
      moveCount: 1,
      status: {
        changes: [
          { kind: "o", amount: -4 },
          { kind: "vp", amount: 5 },
        ],
        overdrawn: [{ kind: "o", amount: -2 }],
        assumedPower: 0,
      },
    });
    expect(container.querySelector(".analysis-controls__resource").getAttribute("aria-label")).to.equal("-4 ore");
    expect(container.querySelector(".analysis-controls__shortfall").getAttribute("title")).to.contain("2 ore");
    expect(container.querySelectorAll(".analysis-controls__resource")[1].getAttribute("aria-label")).to.equal(
      "+5 victory points"
    );
  });

  it("undoes and clears a plan through explicit controls, disabled for an empty plan", async () => {
    const { container, emitted } = controls({ canEdit: true });
    await fireEvent.click(button(container, "Undo"));
    await fireEvent.click(button(container, "Clear plan"));
    expect(emitted().undo).to.have.length(1);
    expect(emitted().reset).to.have.length(1);
    const empty = controls();
    expect(button(empty.container, "Undo").disabled).to.equal(true);
    expect(button(empty.container, "Clear plan").disabled).to.equal(true);
  });

  it("only offers Commit once there is a line, and disables it while nothing in it is committable", async () => {
    expect(button(controls({ moveCount: 0 }).container, "Queue moves")).to.equal(undefined);
    expect(button(controls({ moveCount: 2, committableMoves: 0 }).container, "Queue moves").disabled).to.equal(true);

    const { container, emitted } = controls({ moveCount: 2, committableMoves: 2 });
    const commit = button(container, "Queue moves");
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
