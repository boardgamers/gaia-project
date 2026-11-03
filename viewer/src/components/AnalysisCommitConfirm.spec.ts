import { Phase } from "@gaia-project/engine";
import { mount, Wrapper } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import type { AnalysisCommitPlan } from "../logic/analysis";
import AnalysisCommitConfirm from "./AnalysisCommitConfirm.vue";

Vue.use(BootstrapVue);

// The commit confirmation (ANALYSIS_MODE_PLAN.md §6). Composing a turn inside the sandbox never
// confirms (§12.4); this does, because Commit is the one control whose effect reaches the real game
// - where the sandbox's own Undo does not follow.
describe("AnalysisCommitConfirm", () => {
  const plan = (over: Partial<AnalysisCommitPlan> = {}): AnalysisCommitPlan => ({
    live: null,
    queued: [],
    dropped: [],
    cut: null,
    limit: "line",
    ...over,
  });

  const mounted: Wrapper<Vue>[] = [];
  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.destroy();
  });

  const open = async (p: AnalysisCommitPlan, initialLimit: number | null = null): Promise<Wrapper<Vue>> => {
    const wrapper = mount(AnalysisCommitConfirm, { propsData: { plan: p, initialLimit }, attachTo: document.body });
    mounted.push(wrapper);
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

  it("lets the player queue a prefix and clearly keeps the rest for later", async () => {
    const original = plan({ queued: ["terrans up nav.", "terrans up gaia.", "terrans up eco."] });
    const wrapper = await open(original, 2);

    const queued = document.body.querySelectorAll(".analysis-commit__row--queued");
    expect(Array.from(queued).map((row) => row.querySelector(".analysis-commit__move").textContent)).to.deep.equal([
      "terrans up nav.",
      "terrans up gaia.",
    ]);
    expect(document.body.querySelector(".analysis-commit__deferred").textContent).to.contain("terrans up eco.");
    expect(dialogText()).to.contain("Kept for later");
    expect(dialogText()).not.to.contain("These moves stay saved");
    expect(footerButton("Queue 2 moves")).not.to.equal(undefined);
    expect(wrapper.emitted("confirm")).to.equal(undefined);
    footerButton("Queue 2 moves").click();
    await Vue.nextTick();
    expect(wrapper.emitted("confirm")).to.deep.equal([[2]]);
    expect(original.queued).to.have.length(3);
  });

  it("includes the move that plays now in the chosen limit", async () => {
    const wrapper = await open(plan({ live: "terrans up nav.", queued: ["terrans up gaia.", "terrans up eco."] }), 1);

    expect(document.body.querySelectorAll(".analysis-commit__row--live")).to.have.length(1);
    expect(document.body.querySelectorAll(".analysis-commit__row--queued")).to.have.length(0);
    expect(document.body.querySelectorAll(".analysis-commit__deferred li")).to.have.length(2);
    footerButton("Play 1 move").click();
    await Vue.nextTick();
    expect(wrapper.emitted("confirm")).to.deep.equal([[1]]);
  });

  it("keeps a deliberately deferred move separate from an unavailable tail", async () => {
    await open(plan({ queued: ["a", "b"], dropped: ["c"], cut: "overdrawn" }), 1);

    expect(document.body.querySelector(".analysis-commit__deferred .analysis-commit__move").textContent).to.equal("b");
    expect(document.body.querySelector(".modal .analysis-commit__badge")).to.equal(null);
    expect(dialogText()).not.to.contain("not programmed");
    expect(dialogText()).not.to.contain("not committed");
    expect(dialogText()).to.contain("spend more than you actually have");
    expect(document.body.querySelector(".analysis-commit__dropped-head").textContent).to.contain("1 more");
  });

  it("resets the selection each time the confirmation opens", async () => {
    const wrapper = await open(plan({ queued: ["a", "b", "c"] }), 1);
    await wrapper.setProps({ initialLimit: null });
    wrapper.findComponent({ name: "BModal" }).vm.$emit("show");
    await Vue.nextTick();
    await Vue.nextTick();
    expect(footerButton("Queue 3 moves")).not.to.equal(undefined);
    expect(document.body.querySelector(".analysis-commit__deferred")).to.equal(null);
    expect(wrapper.emitted("confirm")).to.equal(undefined);
  });

  it("invalidates an open confirmation if real progress changes the proposed moves", async () => {
    const wrapper = await open(plan({ queued: ["a", "b", "c"] }), 2);
    await wrapper.setProps({ plan: plan({ queued: ["b", "c"] }) });
    // A queued modal OK event must not turn the old stopping point after b into one after c.
    wrapper.findComponent({ name: "BModal" }).vm.$emit("ok");
    await Vue.nextTick();
    expect(wrapper.emitted("confirm")).to.equal(undefined);
  });

  it("cancels a selected prefix without submitting", async () => {
    const wrapper = await open(plan({ queued: ["a", "b", "c"] }), 2);
    footerButton("Keep planning").click();
    await Vue.nextTick();
    expect(wrapper.emitted("confirm")).to.equal(undefined);
  });

  it("never offers a numeric selector", async () => {
    await open(plan({ live: "a", queued: ["b", "c"] }));
    expect(document.body.querySelector("select")).to.equal(null);
    expect(footerButton("Play 3 moves")).not.to.equal(undefined);
  });

  it("lists every move that is about to be played, saying which one goes live", async () => {
    const wrapper = await open(
      plan({ live: "terrans up nav.", queued: ["terrans build m 1A2.", "terrans pass booster3"] })
    );

    const text = dialogText();
    expect(text).to.contain("terrans up nav.");
    expect(text).to.contain("terrans build m 1A2.");
    expect(text).to.contain("terrans pass booster3");
    expect(text).to.contain("plays now");
    expect(document.body.querySelectorAll(".analysis-commit__row--queued")).to.have.length(2);
    expect(document.body.querySelector(".analysis-commit__row--queued .analysis-commit__badge")).to.equal(null);
    wrapper.destroy();
  });

  it("says nothing plays immediately when the commit happens off turn", async () => {
    const wrapper = await open(
      plan({ live: null, queued: ["terrans up nav."], timings: [{ round: 1, phase: Phase.RoundMove }] })
    );

    expect(dialogText()).to.contain("Queue these premoves?");
    expect(dialogText()).not.to.contain("Round 1");
    expect(document.body.querySelector(".analysis-commit__row--queued .small.text-muted")).to.equal(null);
    expect(document.body.querySelector(".analysis-commit__row--queued .analysis-commit__badge")).to.equal(null);
    expect(dialogText()).to.not.contain("plays now");
    wrapper.destroy();
  });

  it("explains the 3c-only constraint when the plan used a simulated neighbour", async () => {
    await open(plan({ queued: ["terrans build ts 4A4 cheap."], simulatedNeighbour: true }));
    expect(dialogText()).to.contain("3c only");
  });

  it("lists unsent moves without the repeated saved-plan explanation", async () => {
    const wrapper = await open(plan({ live: "terrans up nav.", dropped: ["terrans build ts 1A2."], cut: "overdrawn" }));

    const text = dialogText();
    expect(text).to.contain("1 more move stays behind");
    expect(text).to.contain("spend more than you actually have");
    expect(text).to.contain("terrans build ts 1A2.");
    expect(text).to.not.contain("Your plans stay saved");
    wrapper.destroy();
  });

  it("confirms a longer queue without a move-limit warning", async () => {
    const wrapper = await open(plan({ live: "a", queued: ["b", "c", "d", "e"] }));

    expect(document.body.querySelectorAll(".analysis-commit__row--queued")).to.have.length(4);
    expect(dialogText()).to.not.contain("stay behind");
    expect(footerButton("Play 5 moves")).to.not.equal(undefined);
    wrapper.destroy();
  });

  it("explains that an offline game has no queue to put the rest in", async () => {
    const wrapper = await open(plan({ live: "a", dropped: ["b"], limit: "no-premoves" }));

    expect(dialogText()).to.contain("no premove queue");
    wrapper.destroy();
  });

  it("emits nothing until the player actually confirms", async () => {
    const wrapper = await open(plan({ live: "terrans up nav." }));
    expect(wrapper.emitted("confirm")).to.equal(undefined);

    const ok = footerButton("Play 1 move");
    expect(ok, "the confirm button should name what it is about to do").to.not.equal(undefined);
    ok.click();
    await Vue.nextTick();

    expect(wrapper.emitted("confirm")).to.have.length(1);
    wrapper.destroy();
  });
});
