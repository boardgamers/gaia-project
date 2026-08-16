import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import AnalysisPanel from "./AnalysisPanel.vue";

Vue.use(BootstrapVue);

const COUNTER = {
  credits: { net: -10, displayed: -7 },
  ores: { net: 0, displayed: 15 },
  knowledge: { net: -4, displayed: 11 },
  qics: { net: 1, displayed: 4 },
  victoryPoints: { net: 0, displayed: 10 },
  power: { before: { area1: 4, area2: 2, area3: 3, gaia: 0 }, after: { area1: 2, area2: 2, area3: 1, gaia: 0 } },
  feasible: false,
  infeasibleFromMove: 3,
};

describe("AnalysisPanel", () => {
  it("renders nothing when neither active nor offered", () => {
    const { container } = render(AnalysisPanel, { props: { active: false, offered: false } });
    expect(container.querySelector(".analysis-panel")).to.equal(null);
  });

  it("shows just the entry button when offered but not active", async () => {
    const { container, emitted } = render(AnalysisPanel, { props: { active: false, offered: true } });

    const button = container.querySelector("button");
    expect(button.textContent).to.contain("Enter analysis mode");

    await fireEvent.click(button);

    expect(emitted().enter).to.have.length(1);
  });

  it("shows the move count, controls and per-resource breakdown while active", async () => {
    const { container, emitted } = render(AnalysisPanel, {
      props: { active: true, offered: false, moveCount: 3, counter: COUNTER },
    });

    expect(container.textContent).to.contain("3 moves");
    // §4.2's own worked example shape: negative displayed values read in red/negative styling.
    const credits = Array.from(container.querySelectorAll(".analysis-panel__resource")).find((el) =>
      el.textContent.includes("Credits")
    );
    expect(credits.textContent).to.contain("-7");
    expect(credits.querySelector(".analysis-panel__resource-value--negative")).to.not.equal(null);

    // Power as a bowl-state before/after (§4.3), not an invented scalar.
    expect(container.textContent).to.contain("4/2/3");
    expect(container.textContent).to.contain("2/2/1");

    // Feasibility verdict (§4.3) - not a bare number.
    expect(container.textContent).to.contain("Infeasible from move 3");

    await fireEvent.click(Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Undo")));
    await fireEvent.click(
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Reset"))
    );
    await fireEvent.click(Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Exit")));

    expect(emitted().undo).to.have.length(1);
    expect(emitted().reset).to.have.length(1);
    expect(emitted().exit).to.have.length(1);
  });

  it("explains the missing wallet instead of a breakdown before the sandbox wallet exists (setup entry, Phase 4)", () => {
    const { container } = render(AnalysisPanel, {
      props: { active: true, offered: false, moveCount: 0, counter: null },
    });

    expect(container.textContent).to.contain("No sandbox wallet yet");
  });

  it("shows the two-round cap note only once Pass has actually been capped", () => {
    const capped = render(AnalysisPanel, { props: { active: true, offered: false, passCapped: true } });
    expect(capped.container.textContent).to.contain("Two-round cap reached");

    const uncapped = render(AnalysisPanel, { props: { active: true, offered: false, passCapped: false } });
    expect(uncapped.container.textContent).to.not.contain("Two-round cap reached");
  });

  it("always states the shared single-use resource limitation (decision #11, §4.5)", () => {
    const { container } = render(AnalysisPanel, { props: { active: true, offered: false } });
    expect(container.textContent).to.contain("only one player could actually take them first");
  });
});
