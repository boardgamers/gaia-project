import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import AnalysisPanel from "./AnalysisPanel.vue";

Vue.use(BootstrapVue);

// What is left of this surface: staleness notices and the saved-line prompt, the only two things
// that have to be readable while sandbox mode is NOT active. Everything else - move count, resource
// figures, Undo/Reset/Commit, the help text, the enter and exit buttons, and round 0's faction
// picker - lives in the striped header, the player board, the info modal, the map's corner button
// and Commands.vue's action area respectively. See AnalysisHeaderControls.spec.ts and
// Commands.spec.ts for those halves.

describe("AnalysisPanel", () => {
  it("renders nothing at all when there is no notice, no prompt and no picker", () => {
    const { container } = render(AnalysisPanel, { props: { active: true } });
    expect(container.querySelector(".analysis-strip")).to.equal(null);
  });

  it("no longer offers an enter or exit button - the map's corner button is the only one (§12)", () => {
    const { container } = render(AnalysisPanel, { props: { active: false, notice: "something happened" } });
    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels.some((l) => l.includes("analysis mode"))).to.equal(false);
  });

  describe("staleness notice and pending-restore prompt (§3.5)", () => {
    it("shows a dismissible notice even when analysis mode is not active, and emits dismiss-notice", async () => {
      const { container, emitted } = render(AnalysisPanel, {
        props: { active: false, notice: "Opponents moved since this line was saved." },
      });

      expect(container.querySelector(".analysis-strip").textContent).to.contain("Opponents moved");

      await fireEvent.click(container.querySelector(".analysis-strip__banner-x"));

      expect(emitted()["dismiss-notice"]).to.have.length(1);
    });

    it("prompts to restore or discard a stored line, and emits both answers", async () => {
      const pendingRestore = {
        lines: [[{ kind: "move", move: "terrans up nav." }]],
        active: 0,
        baseRound: 1,
        baseMoveCount: 9,
      };
      const { container, emitted } = render(AnalysisPanel, { props: { active: true, pendingRestore } });

      const buttons = Array.from(container.querySelectorAll("button"));
      const restore = buttons.find((b) => b.textContent.includes("Restore anyway"));
      const discard = buttons.find((b) => b.textContent.includes("Discard"));
      expect(container.querySelector(".analysis-strip").textContent).to.contain("1 move");

      await fireEvent.click(restore);
      await fireEvent.click(discard);

      expect(emitted().restore).to.have.length(1);
      expect(emitted()["discard-restore"]).to.have.length(1);
    });

    // §13: Restore/Discard answers for every stored line at once, so quoting only the open line's
    // length would understate what Discard is about to throw away.
    it("counts every line and every move when more than one was stored", () => {
      const pendingRestore = {
        lines: [[{ kind: "move", move: "terrans up nav." }], [{ kind: "move", move: "terrans up gaia." }], []],
        active: 1,
        baseRound: 1,
        baseMoveCount: 9,
      };
      const { container } = render(AnalysisPanel, { props: { active: true, pendingRestore } });
      const text = container.querySelector(".analysis-strip").textContent;
      expect(text).to.contain("3 saved sandbox lines");
      expect(text).to.contain("2 moves in total");
    });

    it("does not show the restore prompt while analysis mode is inactive", () => {
      const pendingRestore = {
        lines: [[{ kind: "move", move: "terrans up nav." }]],
        active: 0,
        baseRound: 1,
        baseMoveCount: 9,
      };
      const { container } = render(AnalysisPanel, { props: { active: false, pendingRestore } });
      expect(container.querySelector(".analysis-strip__banner--confirm")).to.equal(null);
    });
  });

  it("no longer carries round 0's faction picker - that moved into Commands.vue's action area", () => {
    const { container } = render(AnalysisPanel, { props: { active: true, notice: "something happened" } });
    expect(container.querySelector(".analysis-strip__seed")).to.equal(null);
    expect(container.querySelector("select")).to.equal(null);
  });
});
