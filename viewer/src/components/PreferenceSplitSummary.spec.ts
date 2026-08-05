import Engine, { AuctionVariant } from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import PreferenceSplitSummary from "./PreferenceSplitSummary.vue";

Vue.use(BootstrapVue);

/** The deterministic fixture: Terrans to p4 for 13, Itars to p1 for 10, Taklons to p2 for 9,
 * Xenos to p3 for 9. */
const RESOLVED = [
  "init 4 djfjjv4k",
  "p1 faction itars",
  "p2 faction taklons",
  "p3 faction xenos",
  "p4 faction terrans",
  "p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2",
  "p2 preferenceBid itars 16 taklons 14 xenos 8 terrans 2",
  "p3 preferenceBid itars 2 taklons 6 xenos 10 terrans 22",
  "p4 preferenceBid itars 0 taklons 4 xenos 11 terrans 25",
];

function mount(moves: string[] = RESOLVED) {
  const engine = new Engine([...moves], { auction: AuctionVariant.PreferenceSplit });
  const store = makeStore();
  store.commit("receiveData", engine);
  return render(PreferenceSplitSummary, { store });
}

describe("PreferenceSplitSummary", () => {
  beforeEach(() => window.localStorage.clear());

  it("announces the result under the banner, with every winner and price", () => {
    const { container } = mount();
    const text = container.textContent ?? "";

    expect(text).to.contain("Preference Split Auction resolved");
    expect(text).to.contain("Terrans");
    expect(text).to.contain("13 VP");
    expect(text).to.contain("Itars");
    expect(text).to.contain("10 VP");
    expect(text).to.contain("Xenos");
  });

  it("opens the full log from the strip", async () => {
    const { container, getByText, baseElement } = mount();

    expect(container.querySelector(".auction-summary")).to.not.equal(null);
    await fireEvent.click(getByText("Full log"));
    await Vue.nextTick();

    // The modal renders outside the component's own container (bootstrap-vue portals it).
    const modal = (baseElement.textContent ?? "") + (container.textContent ?? "");
    expect(modal).to.contain("Every bid");
    expect(modal).to.contain("How each faction was awarded");
  });

  it("can be dismissed, and stays dismissed for this game on this device", async () => {
    const { container, getByText } = mount();

    await fireEvent.click(getByText("Dismiss"));
    await Vue.nextTick();
    expect(container.querySelector(".auction-summary")).to.equal(null);

    // A fresh mount of the same game stays dismissed...
    expect(mount().container.querySelector(".auction-summary")).to.equal(null);
    // ...while a different game is unaffected (a different seed = a different storage key).
    const other = mount(RESOLVED.map((move) => move.replace("init 4 djfjjv4k", "init 4 otherseed")));
    expect(other.container.querySelector(".auction-summary")).to.not.equal(null);
  });

  it("shows nothing at all before the auction has resolved", () => {
    const { container } = mount(RESOLVED.slice(0, 5));
    expect(container.querySelector(".auction-summary")).to.equal(null);
  });
});
