import { Phase } from "@gaia-project/engine";
import type { PremoveRun } from "@gaia-project/engine/src/premove-types";
import { mount } from "@vue/test-utils";
import { expect } from "chai";
import AnalysisMoves from "./AnalysisMoves.vue";
import PremoveQueue from "./PremoveQueue.vue";

const run: PremoveRun = {
  id: "queue-1",
  status: "stopped",
  reason: "Not enough knowledge",
  steps: ["played", "blocked", "unplayed"].map((status, index) => ({
    move: ["nevlas up nav.", "nevlas up gaia.", "nevlas up eco."][index],
    timing: { round: 1, phase: Phase.RoundMove },
    status: status as PremoveRun["steps"][number]["status"],
  })),
};

describe("premove history", () => {
  it("shows the stopping point and tail after refresh; reviewing does not resubmit anything", async () => {
    const view = mount(PremoveQueue, {
      propsData: {
        plan: { moves: [], revision: 4, round: 1, runs: [run] },
        noticeStorageKey: "test",
        canPreview: true,
      },
    });
    expect(view.text()).to.include("1/3 played").and.include("Stopped at 2").and.include("Not enough knowledge");
    expect(view.findAll(".premove-timeline__steps li")).to.have.length(3);
    expect(view.text()).to.include("✓ Played").and.include("Not played");
    expect(view.find("button").text()).to.equal("Review remaining");
    await view.find("button").trigger("click");
    expect(view.emitted("view")[0][0]).to.deep.equal(run);
    expect(view.emitted("cancel")).to.equal(undefined);
    expect(view.text()).not.to.include("Cancel");
    view.destroy();
  });

  it("keeps played variation rows read-only and numbers remaining edits after them", async () => {
    const view = mount(AnalysisMoves, {
      propsData: {
        played: [{ move: "nevlas up nav.", moveIndex: 10 }],
        entries: [
          { kind: "move", move: "nevlas up gaia." },
          { kind: "move", move: "nevlas up eco." },
        ],
        appliedCount: 0,
        blockedReason: "Not enough knowledge",
      },
    });
    expect(view.find(".analysis-moves__past").text()).to.include("✓ Played");
    expect(view.find(".analysis-moves__past button").exists()).to.equal(false);
    expect(view.find(".analysis-moves__move").attributes("aria-label")).to.equal("Edit move 2: nevlas up gaia.");
    expect(view.text()).to.include("Not enough knowledge").and.include("Not simulated");
    await view.find(".analysis-moves__move").trigger("click");
    expect(view.emitted("edit")).to.deep.equal([[0]]);
    view.destroy();
  });
});
