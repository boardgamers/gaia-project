import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { AnalysisLineSummary, MAX_ANALYSIS_LINES } from "../logic/analysis";
import AnalysisLineTabs from "./AnalysisLineTabs.vue";

Vue.use(BootstrapVue);

// §13's line strip. Like AnalysisHeaderControls, this is rendered twice per page (desktop title +
// mobile sticky band) and owns no state of its own - Game.vue holds the lines and this only reports
// presses, which is what keeps the two copies from ever disagreeing about which tab is open.
describe("AnalysisLineTabs", () => {
  const line = (over: Partial<AnalysisLineSummary> = {}): AnalysisLineSummary => ({
    label: "Line 1",
    moves: 0,
    victoryPoints: 0,
    overdrawn: false,
    applied: 0,
    ...over,
  });

  const tabs = (props: Record<string, unknown> = {}) =>
    render(AnalysisLineTabs, { props: { lines: [line()], active: 0, ...props } });

  function tabButtons(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(".analysis-tabs__tab"));
  }

  /** The tab's own label without the nested delete control's ✕ - that button lives inside the open
   * tab now, so a bare textContent picks it up too. */
  function tabText(el: HTMLElement): string {
    return Array.from(el.childNodes)
      .filter((n) => !(n as HTMLElement).classList?.contains("analysis-tabs__close"))
      .map((n) => n.textContent)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  it("numbers the tabs rather than naming them", () => {
    const { container } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 0 });
    expect(tabButtons(container).map(tabText)).to.deep.equal(["Line 1", "Line 2"]);
  });

  it("marks the open tab, and only it", () => {
    const { container } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 1 });
    const marked = tabButtons(container).map((b) => b.classList.contains("analysis-tabs__tab--active"));
    expect(marked).to.deep.equal([false, true]);
  });

  // The reason the strip is a comparison and not a bookmark list: switching replaces the board, so
  // every line's outcome has to be readable without switching to it.
  it("puts each line's own VP on its own tab", () => {
    const { container } = tabs({
      lines: [line({ moves: 3, victoryPoints: 7 }), line({ label: "Line 2", moves: 2, victoryPoints: -2 })],
      active: 0,
    });
    const text = tabButtons(container).map(tabText);
    expect(text[0]).to.contain("+7");
    expect(text[1]).to.contain("-2");
  });

  it("says nothing about VP for a line with nothing played yet", () => {
    const { container } = tabs({ lines: [line()], active: 0 });
    expect(container.querySelector(".analysis-tabs__vp")).to.equal(null);
  });

  it("flags a line whose VP was bought with resources the seat does not have", () => {
    const { container } = tabs({ lines: [line({ moves: 2, victoryPoints: 4, overdrawn: true, applied: 2 })] });
    expect(container.querySelector(".analysis-tabs__flag--overdrawn")).to.not.equal(null);
  });

  it("flags a line the current board only partly still accepts", () => {
    const { container } = tabs({ lines: [line({ moves: 4, applied: 2 })] });
    const flag = container.querySelector(".analysis-tabs__flag");
    expect(flag).to.not.equal(null);
    expect(flag.classList.contains("analysis-tabs__flag--overdrawn")).to.equal(false);
  });

  it("reports a press on a tab as a line to open", async () => {
    const { container, emitted } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 0 });
    await fireEvent.click(tabButtons(container)[1]);
    expect(emitted().select[0]).to.deep.equal([1]);
  });

  it("reports the plus as a new line", async () => {
    const { container, emitted } = tabs();
    await fireEvent.click(container.querySelector(".analysis-tabs__add"));
    expect(emitted().add.length).to.equal(1);
  });

  it("stops offering new lines at the cap", () => {
    const lines = Array.from({ length: MAX_ANALYSIS_LINES }, (_, i) => line({ label: `Line ${i + 1}` }));
    const { container } = tabs({ lines, active: 0 });
    expect((container.querySelector(".analysis-tabs__add") as HTMLButtonElement).disabled).to.equal(true);
  });

  // Deleting is offered on the open tab only, and never on the last one: an ✕ on every tab would put
  // five ways to lose work one mis-tap from the control used to switch between them.
  it("offers no delete while there is only one line", () => {
    const { container } = tabs();
    expect(container.querySelector(".analysis-tabs__close")).to.equal(null);
  });

  it("puts delete inside the open tab, and nowhere else", () => {
    const { container } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 1 });
    const closes = container.querySelectorAll(".analysis-tabs__close");
    expect(closes.length).to.equal(1);
    expect(tabButtons(container)[1].contains(closes[0])).to.equal(true);
  });

  it("reports delete against the open line, without also selecting it", async () => {
    const { container, emitted } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 1 });
    await fireEvent.click(container.querySelector(".analysis-tabs__close"));
    expect(emitted().close[0]).to.deep.equal([1]);
    expect(emitted().select).to.equal(undefined);
  });

  it("opens a line from the keyboard", async () => {
    const { container, emitted } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 0 });
    await fireEvent.keyDown(tabButtons(container)[1], { key: "Enter", code: "Enter" });
    expect(emitted().select[0]).to.deep.equal([1]);
  });

  // Load-bearing: the striped header these sit on is click-to-exit, so a press that reached it would
  // close the sandbox instead of switching lines.
  it("keeps a press on the strip off the header behind it", async () => {
    const { container } = tabs({ lines: [line(), line({ label: "Line 2" })], active: 0 });
    const host = document.createElement("div");
    let reachedHeader = false;
    host.addEventListener("click", () => (reachedHeader = true));
    host.appendChild(container);
    document.body.appendChild(host);

    await fireEvent.click(tabButtons(container)[1]);

    expect(reachedHeader).to.equal(false);
    host.remove();
  });
});
