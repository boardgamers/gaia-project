import { mount, Wrapper } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { AnalysisCommitPlan } from "../logic/analysis";
import AnalysisCommitConfirm from "./AnalysisCommitConfirm.vue";

Vue.use(BootstrapVue);

// The commit confirmation (ANALYSIS_MODE_PLAN.md §6). Composing a turn inside the sandbox never
// confirms (§12.4); this does, because Commit is the one control whose effect reaches the real game
// - where the sandbox's own Undo does not follow - and it clears the line on the way out.
describe("AnalysisCommitConfirm", () => {
  const plan = (over: Partial<AnalysisCommitPlan> = {}): AnalysisCommitPlan => ({
    live: null,
    queued: [],
    dropped: [],
    cut: null,
    limit: "line",
    ...over,
  });

  const open = async (p: AnalysisCommitPlan): Promise<Wrapper<Vue>> => {
    const wrapper = mount(AnalysisCommitConfirm, { propsData: { plan: p }, attachTo: document.body });
    wrapper.vm.$bvModal.show("analysis-commit-confirm");
    await Vue.nextTick();
    await Vue.nextTick();
    return wrapper;
  };

  // bootstrap-vue portals the dialog out to <body>, so the text under test is never inside the
  // component's own element - the same detail PreferenceSplitSummary.spec.ts notes.
  const dialogText = () => (document.body.querySelector(".modal")?.textContent ?? "").replace(/\s+/g, " ");

  const footerButton = (label: string) =>
    Array.from(document.body.querySelectorAll(".modal-footer button")).find((b) =>
      (b.textContent ?? "").includes(label)
    ) as HTMLButtonElement | undefined;

  it("lists every move that is about to be played, saying which one goes live", async () => {
    const wrapper = await open(
      plan({ live: "terrans up nav.", queued: ["terrans build m 1A2.", "terrans pass booster3"] })
    );

    const text = dialogText();
    expect(text).to.contain("terrans up nav.");
    expect(text).to.contain("terrans build m 1A2.");
    expect(text).to.contain("terrans pass booster3");
    expect(text).to.contain("plays now");
    expect(text).to.contain("premove 1");
    expect(text).to.contain("premove 2");
    wrapper.destroy();
  });

  it("says nothing plays immediately when the commit happens off turn", async () => {
    const wrapper = await open(plan({ live: null, queued: ["terrans up nav."] }));

    expect(dialogText()).to.contain("not your turn");
    expect(dialogText()).to.not.contain("plays now");
    wrapper.destroy();
  });

  it("lists the moves being left behind and why, since committing clears the line", async () => {
    const wrapper = await open(plan({ live: "terrans up nav.", dropped: ["terrans build ts 1A2."], cut: "overdrawn" }));

    const text = dialogText();
    expect(text).to.contain("1 more move stays behind");
    expect(text).to.contain("spend more than you actually have");
    expect(text).to.contain("terrans build ts 1A2.");
    expect(text).to.contain("clears this line");
    wrapper.destroy();
  });

  it("blames the premove queue rather than the line when the queue is what ran out", async () => {
    const wrapper = await open(plan({ live: "a", queued: ["b"], dropped: ["c", "d"], limit: "queue" }));

    expect(dialogText()).to.contain("2 more moves stay behind");
    expect(dialogText()).to.contain("premove queue is full");
    wrapper.destroy();
  });

  it("explains that an offline game has no queue to put the rest in", async () => {
    const wrapper = await open(plan({ live: "a", dropped: ["b"], limit: "no-premoves" }));

    expect(dialogText()).to.contain("no premove queue");
    wrapper.destroy();
  });

  it("explains an assumed-power cut in the terms the player can act on", async () => {
    const wrapper = await open(plan({ live: "a", dropped: ["b"], cut: "assumed-power" }));

    expect(dialogText()).to.contain("topped up your power");
    wrapper.destroy();
  });

  it("emits nothing until the player actually confirms", async () => {
    const wrapper = await open(plan({ live: "terrans up nav." }));
    expect(wrapper.emitted("confirm")).to.equal(undefined);

    const ok = footerButton("Commit 1 move");
    expect(ok, "the confirm button should name what it is about to do").to.not.equal(undefined);
    ok.click();
    await Vue.nextTick();

    expect(wrapper.emitted("confirm")).to.have.length(1);
    wrapper.destroy();
  });
});
