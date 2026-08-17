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

  describe("Phase 6 - staleness notice and pending-restore prompt (§3.5)", () => {
    it("shows a dismissible notice regardless of active/offered, and emits dismiss-notice", async () => {
      const { container, emitted } = render(AnalysisPanel, {
        props: { active: false, offered: false, notice: "Opponents moved since this line was saved." },
      });

      expect(container.textContent).to.contain("Opponents moved since this line was saved.");

      await fireEvent.click(container.querySelector(".analysis-panel__banner-x"));

      expect(emitted()["dismiss-notice"]).to.have.length(1);
    });

    it("shows nothing when neither active, offered, notice nor pendingRestore is set", () => {
      const { container } = render(AnalysisPanel, { props: { active: false, offered: false } });
      expect(container.querySelector(".analysis-panel")).to.equal(null);
    });

    it("prompts to restore or discard a pending stored line, only while active, and emits both answers", async () => {
      const pendingRestore = { entries: [{ kind: "move", move: "terrans up nav." }], baseRound: 1, baseMoveCount: 9 };
      const { container, emitted } = render(AnalysisPanel, {
        props: { active: true, offered: false, pendingRestore },
      });

      expect(container.textContent).to.contain("1 move");
      expect(container.textContent).to.contain("exists from before your last move");

      const buttons = Array.from(container.querySelectorAll("button"));
      await fireEvent.click(buttons.find((b) => b.textContent.includes("Restore anyway")));
      await fireEvent.click(buttons.find((b) => b.textContent.includes("Discard")));

      expect(emitted().restore).to.have.length(1);
      expect(emitted()["discard-restore"]).to.have.length(1);
    });

    it("does not show the pending-restore prompt while merely offered, not active", () => {
      const pendingRestore = { entries: [{ kind: "move", move: "terrans up nav." }], baseRound: 1, baseMoveCount: 9 };
      const { container } = render(AnalysisPanel, {
        props: { active: false, offered: true, pendingRestore },
      });
      expect(container.textContent).to.not.contain("exists from before your last move");
    });
  });

  describe("Phase 6 - the leech adjustment stepper (§4.4, decision #12)", () => {
    it("emits adjust with the entered charge when Add is clicked", async () => {
      const { container, emitted } = render(AnalysisPanel, {
        props: { active: true, offered: false, moveCount: 0, counter: COUNTER },
      });

      const input = container.querySelector("#analysis-adjust-charge") as HTMLInputElement;
      await fireEvent.update(input, "3");
      const addButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Add"));
      await fireEvent.click(addButton);

      expect(emitted().adjust).to.deep.equal([[3]]);
    });

    it("disables Add for a non-positive charge", async () => {
      const { container } = render(AnalysisPanel, {
        props: { active: true, offered: false, moveCount: 0, counter: COUNTER },
      });

      const input = container.querySelector("#analysis-adjust-charge") as HTMLInputElement;
      await fireEvent.update(input, "0");
      const addButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Add"));

      expect((addButton as HTMLButtonElement).disabled).to.equal(true);
    });

    it("does not render the stepper before a sandbox wallet exists (counter null)", () => {
      const { container } = render(AnalysisPanel, {
        props: { active: true, offered: false, moveCount: 0, counter: null },
      });
      expect(container.querySelector("#analysis-adjust-charge")).to.equal(null);
    });
  });

  describe("Phase 7 - the commit path (§6, decision #13)", () => {
    function commitButton(container: HTMLElement): HTMLButtonElement {
      return Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent.includes("ommit")
      ) as HTMLButtonElement;
    }

    it("is not shown at all for an empty line", () => {
      const { container } = render(AnalysisPanel, { props: { active: true, offered: false, moveCount: 0 } });
      expect(commitButton(container)).to.equal(undefined);
    });

    it("is disabled with an explanatory label when nothing in the line is committable", () => {
      const { container } = render(AnalysisPanel, {
        props: { active: true, offered: false, moveCount: 1, committableMoves: 0 },
      });
      const button = commitButton(container);
      expect(button.textContent).to.contain("Nothing committable yet");
      expect(button.disabled).to.equal(true);
    });

    it("labels a single committable move distinctly from several, and emits commit when clicked", async () => {
      const single = render(AnalysisPanel, {
        props: { active: true, offered: false, moveCount: 1, committableMoves: 1 },
      });
      expect(commitButton(single.container).textContent).to.contain("Commit this move");
      expect(commitButton(single.container).disabled).to.equal(false);

      const { container, emitted } = render(AnalysisPanel, {
        props: { active: true, offered: false, moveCount: 3, committableMoves: 3 },
      });
      expect(commitButton(container).textContent).to.contain("Commit 3 moves (1 live + 2 queued)");

      await fireEvent.click(commitButton(container));

      expect(emitted().commit).to.have.length(1);
    });
  });

  describe("the round-0 faction seed picker (\u00a711)", () => {
    const CHOICES = [
      { faction: "terrans", name: "Terrans" },
      { faction: "nevlas", name: "Nevlas" },
    ];

    function seedButton(container: HTMLElement): HTMLButtonElement {
      return Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent.includes("Try this")
      ) as HTMLButtonElement;
    }

    it("is not rendered when the clone is past faction selection (no choices offered)", () => {
      const { container } = render(AnalysisPanel, {
        props: { active: true, offered: false, counter: COUNTER, factionChoices: [] },
      });
      expect(container.querySelector(".analysis-panel__seed")).to.equal(null);
    });

    it("offers every choice and emits seed-faction for the selected one", async () => {
      const { container, emitted } = render(AnalysisPanel, {
        props: { active: true, offered: false, factionChoices: CHOICES },
      });

      const options = Array.from(container.querySelectorAll("option")).map((o) => o.textContent.trim());
      expect(options).to.deep.equal(["Terrans", "Nevlas"]);

      await fireEvent.update(container.querySelector("select") as HTMLSelectElement, "nevlas");
      await fireEvent.click(seedButton(container));

      expect(emitted()["seed-faction"]).to.have.length(1);
      expect(emitted()["seed-faction"][0]).to.deep.equal(["nevlas"]);
    });

    it("defaults to the first choice, so the button is armed without touching the select", async () => {
      const { container, emitted } = render(AnalysisPanel, {
        props: { active: true, offered: false, factionChoices: CHOICES },
      });

      await fireEvent.click(seedButton(container));

      expect(emitted()["seed-faction"][0]).to.deep.equal(["terrans"]);
    });

    it("shows the seeded table back, marking which seat is mine, and relabels the button", () => {
      const { container } = render(AnalysisPanel, {
        props: {
          active: true,
          offered: false,
          factionChoices: CHOICES,
          seatedLineup: [
            { name: "Terrans", mine: false },
            { name: "Nevlas", mine: true },
          ],
        },
      });

      const lineup = container.querySelector(".analysis-panel__seed-lineup");
      expect(lineup.textContent).to.contain("Terrans");
      expect(lineup.textContent).to.contain("Nevlas (you)");
      expect(seedButton(container).textContent).to.contain("Try this one instead");
    });
  });
});
