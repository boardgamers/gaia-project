import Engine, { AuctionVariant, Phase } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import SetupStatus from "./SetupStatus.vue";

Vue.use(BootstrapVue);

describe("SetupStatus", () => {
  function mountFor(engine: Engine, seat?: number) {
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);
    if (seat !== undefined) {
      store.commit("player", { index: seat });
    }
    return mount(SetupStatus, { store, attachTo: document.body });
  }

  function silentAuctionEngine(moves: string[] = []) {
    return new Engine(["init 3 setup-status", ...moves], { auction: AuctionVariant.Silent });
  }

  it("shows compact ban and auction links during an auction's ban phase, and opens the auction explainer", async () => {
    const wrapper = mountFor(silentAuctionEngine());

    const links = wrapper.find(".setup-status__links");
    expect(links.exists()).to.equal(true);
    expect(links.text()).to.contain("Ban phase");
    expect(links.text()).to.contain("Auction type");
    expect(wrapper.findAll(".setup-status__info").length).to.equal(2);

    await wrapper.find(".setup-status__info--auction").trigger("click");
    await Vue.nextTick();

    expect(document.body.textContent).to.contain("How the Silent Auction works");
    expect(document.body.textContent).to.contain("Ban");

    wrapper.destroy();
  });

  it("offers the ban-phase explainer, not the auction one, when a non-auction game bans", () => {
    const engine = new Engine(["init 2 setup-status-ban"], { banPhase: true });
    expect(engine.phase).to.equal(Phase.SetupFactionBan);

    const wrapper = mountFor(engine);
    expect(wrapper.find(".setup-status__info--ban").text()).to.contain("Ban phase");
    expect(wrapper.find(".setup-status__info--auction").exists()).to.equal(false);
    wrapper.destroy();
  });

  for (const [variant, title] of [
    [AuctionVariant.ChooseBid, "Choose, Then Bid"],
    [AuctionVariant.BidWhileChoosing, "Bid While Choosing"],
  ] as const) {
    it(`offers an in-game explainer for ${title} during the ban phase`, async () => {
      const engine = new Engine([`init 3 setup-status-${variant}`], { auction: variant, banPhase: true });
      expect(engine.phase).to.equal(Phase.SetupFactionBan);

      const wrapper = mountFor(engine);
      const auctionInfo = wrapper.find(".setup-status__info--auction");
      expect(auctionInfo.exists()).to.equal(true);
      expect(auctionInfo.text()).to.contain("Auction type");
      expect(auctionInfo.attributes("aria-label")).to.contain(title);

      await auctionInfo.trigger("click");
      await Vue.nextTick();

      expect(document.body.textContent).to.contain(`How ${title} works`);
      expect(document.body.textContent).to.contain("Victory Points");
      wrapper.destroy();
    });
  }

  it("renders no banner for a plain faction pick", () => {
    const engine = new Engine(["init 2 setup-status-plain"]);
    expect(engine.phase).to.equal(Phase.SetupFaction);

    const wrapper = mountFor(engine);
    expect(wrapper.find(".setup-status").exists()).to.equal(false);
    expect(wrapper.find(".setup-status__info").exists()).to.equal(false);
    wrapper.destroy();
  });

  it("says nothing at all while a hosted sealed auction is open, where nobody is 'on turn'", () => {
    // Every seat bids at once, so naming one of them would be actively wrong - and the bid panel
    // right below reports what is really happening (n of 3 in).
    const engine = silentAuctionEngine([
      "p1 banFaction terrans",
      "p2 banFaction lantids",
      "p3 banFaction gleens",
      "p1 faction itars",
      "p2 faction taklons",
      "p3 faction xenos",
    ]);
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);
    store.commit("setSealedBidBackend", { submit: async () => undefined, refresh: async () => undefined });

    const wrapper = mount(SetupStatus, { store, attachTo: document.body });
    expect(wrapper.find(".setup-status").exists()).to.equal(false);
    wrapper.destroy();
  });

  it("renders nothing once round 1 has started", () => {
    const setup = mountFor(silentAuctionEngine());
    expect(setup.find(".setup-status").exists()).to.equal(true);
    setup.destroy();

    // Contextual setup rules are not shown once play begins.
    const engine = silentAuctionEngine();
    (engine as any).round = 1;

    const wrapper = mountFor(engine);
    expect(wrapper.find(".setup-status").exists()).to.equal(false);
    expect(wrapper.text()).to.equal("");
    wrapper.destroy();
  });
});
