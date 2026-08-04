import Engine, { AuctionVariant } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import SilentAuctionSummary from "./SilentAuctionSummary.vue";

Vue.use(BootstrapVue);

const DISMISSED_PREFIX = "gaia-silent-auction-summary-dismissed-v1:";

describe("SilentAuctionSummary", () => {
  beforeEach(() => window.localStorage.clear());

  function resolvedAuction() {
    return new Engine(
      [
        "init 3 auction-summary",
        "p1 banFaction terrans",
        "p2 banFaction lantids",
        "p3 banFaction gleens",
        "p1 faction itars",
        "p2 faction taklons",
        "p3 faction xenos",
        "p1 silentBid itars 6 taklons 4 xenos 0",
        "p2 silentBid itars 7 taklons 3 xenos 2",
        "p3 silentBid itars 3 taklons 0 xenos 0",
      ],
      { auction: AuctionVariant.Silent }
    );
  }

  function mountFor(engine: Engine) {
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);
    return mount(SilentAuctionSummary, { store, attachTo: document.body });
  }

  it("summarises who won what, and for how much", () => {
    const engine = resolvedAuction();
    const wrapper = mountFor(engine);
    const text = wrapper.text();

    expect(text).to.contain("Silent Auction resolved");
    // The auction gives Itars to p2 for 3, Taklons to p1 for 0, Xenos to p3 for 0 (see
    // SilentAuctionInfo.spec.ts, which pins the same worked example against the engine).
    expect(text).to.contain("Itars to Player 2 for 3 VP");
    expect(text).to.contain("Taklons to Player 1 for 0 VP");
    expect(text).to.contain("Xenos to Player 3 for 0 VP");

    wrapper.destroy();
  });

  it("shows nothing before an auction has resolved", () => {
    const engine = new Engine(["init 3 auction-summary"], { auction: AuctionVariant.Silent });
    const wrapper = mountFor(engine);

    expect(wrapper.find(".auction-summary").exists()).to.equal(false);
    wrapper.destroy();
  });

  it("stays dismissed for that game only, across reloads", async () => {
    const wrapper = mountFor(resolvedAuction());

    await wrapper.findAll(".auction-summary__action").at(1).trigger("click");
    expect(window.localStorage.getItem(DISMISSED_PREFIX + "auction-summary")).to.equal("1");
    wrapper.destroy();

    // Same game again (a reload): still dismissed.
    const reopened = mountFor(resolvedAuction());
    expect(reopened.find(".auction-summary").exists()).to.equal(false);
    reopened.destroy();

    // A different game keeps its own summary.
    const other = resolvedAuction();
    (other.map as any).seed = "another-game";
    const otherWrapper = mountFor(other);
    expect(otherWrapper.find(".auction-summary").exists()).to.equal(true);
    otherWrapper.destroy();
  });

  it("opens the full log from the banner", async () => {
    const wrapper = mountFor(resolvedAuction());

    await wrapper.findAll(".auction-summary__action").at(0).trigger("click");
    await Vue.nextTick();
    await Vue.nextTick();

    const modalText = document.body.querySelector(".modal")?.textContent ?? "";
    expect(modalText).to.contain("Bans");
    expect(modalText).to.contain("Resolution");
    expect(modalText).to.contain("Bids");

    wrapper.destroy();
  });
});
