import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import AnalysisPanel from "./AnalysisPanel.vue";

Vue.use(BootstrapVue);

// What is left of this surface after §12: staleness notices, the saved-line prompt and round 0's
// faction picker. Everything else (move count, resource figures, Undo/Reset/Commit, the help text,
// the enter and exit buttons) moved to the striped header, the player board, the info modal and the
// map's corner button respectively - see AnalysisHeaderControls.spec.ts for the header half.
const CHOICES = [
  { faction: "terrans", name: "Terrans" },
  { faction: "nevlas", name: "Nevlas" },
];

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
      const pendingRestore = { entries: [{ kind: "move", move: "terrans up nav." }], baseRound: 1, baseMoveCount: 9 };
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

    it("does not show the restore prompt while analysis mode is inactive", () => {
      const pendingRestore = { entries: [{ kind: "move", move: "terrans up nav." }], baseRound: 1, baseMoveCount: 9 };
      const { container } = render(AnalysisPanel, { props: { active: false, pendingRestore } });
      expect(container.querySelector(".analysis-strip__banner--confirm")).to.equal(null);
    });
  });

  describe("the round-0 faction seed picker (§11)", () => {
    function seedButton(container: HTMLElement): HTMLButtonElement {
      return Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent.includes("Try this")
      ) as HTMLButtonElement;
    }

    it("is not rendered when the clone is past faction selection (no choices offered)", () => {
      const { container } = render(AnalysisPanel, { props: { active: true, factionChoices: [] } });
      expect(container.querySelector(".analysis-strip__seed")).to.equal(null);
    });

    it("offers every choice and emits seed-faction for the selected one", async () => {
      const { container, emitted } = render(AnalysisPanel, { props: { active: true, factionChoices: CHOICES } });

      const options = Array.from(container.querySelectorAll("option")).map((o) => o.textContent.trim());
      expect(options).to.deep.equal(["Terrans", "Nevlas"]);

      await fireEvent.update(container.querySelector("select") as HTMLSelectElement, "nevlas");
      await fireEvent.click(seedButton(container));

      expect(emitted()["seed-faction"]).to.have.length(1);
      expect(emitted()["seed-faction"][0]).to.deep.equal(["nevlas"]);
    });

    it("defaults to the first choice, so the button is armed without touching the select", async () => {
      const { container, emitted } = render(AnalysisPanel, { props: { active: true, factionChoices: CHOICES } });

      await fireEvent.click(seedButton(container));

      expect(emitted()["seed-faction"][0]).to.deep.equal(["terrans"]);
    });

    it("shows the seeded table back, marking which seat is mine, and relabels the button", () => {
      const { container } = render(AnalysisPanel, {
        props: {
          active: true,
          factionChoices: CHOICES,
          seatedLineup: [
            { name: "Terrans", mine: false },
            { name: "Nevlas", mine: true },
          ],
        },
      });

      const lineup = container.querySelector(".analysis-strip__lineup");
      expect(lineup.textContent).to.contain("Terrans");
      expect(lineup.textContent).to.contain("Nevlas (you)");
      expect(seedButton(container).textContent).to.contain("Try this one instead");
    });

    it("does not offer the picker while analysis mode is inactive", () => {
      const { container } = render(AnalysisPanel, { props: { active: false, factionChoices: CHOICES } });
      expect(container.querySelector(".analysis-strip__seed")).to.equal(null);
    });
  });
});
