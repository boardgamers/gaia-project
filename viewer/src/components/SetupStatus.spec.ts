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

  it("names the player on turn and what they have to do", () => {
    const engine = silentAuctionEngine();
    engine.players[0].name = "Mark";
    expect(engine.phase).to.equal(Phase.SetupFactionBan);

    const wrapper = mountFor(engine);
    expect(wrapper.text()).to.contain("Mark's turn");
    expect(wrapper.text()).to.contain("to ban a faction");
    wrapper.destroy();
  });

  it("addresses the player whose seat is being viewed in the second person", () => {
    const engine = silentAuctionEngine();
    engine.players[0].name = "Mark";

    const wrapper = mountFor(engine, 0);
    expect(wrapper.text()).to.contain("Your turn");
    expect(wrapper.text()).to.not.contain("Mark's turn");
    wrapper.destroy();
  });

  it("keeps showing whose turn it is for a player who cannot act (the case Commands.vue never covered)", () => {
    const engine = silentAuctionEngine();
    engine.players[0].name = "Mark";

    // Seat 2 is watching while seat 0 bans - the action panel isn't rendered for them at all.
    const wrapper = mountFor(engine, 2);
    expect(wrapper.text()).to.contain("Mark's turn");
    expect(wrapper.text()).to.contain("to ban a faction");
    wrapper.destroy();
  });

  it("follows the phase through pick and silent bid", () => {
    const picking = silentAuctionEngine(["p1 banFaction terrans", "p2 banFaction lantids", "p3 banFaction gleens"]);
    expect(picking.phase).to.equal(Phase.SetupFaction);
    let wrapper = mountFor(picking);
    expect(wrapper.text()).to.contain("to pick a faction");
    wrapper.destroy();

    const bidding = silentAuctionEngine([
      "p1 banFaction terrans",
      "p2 banFaction lantids",
      "p3 banFaction gleens",
      "p1 faction itars",
      "p2 faction taklons",
      "p3 faction xenos",
    ]);
    expect(bidding.phase).to.equal(Phase.SetupSilentBid);
    wrapper = mountFor(bidding);
    expect(wrapper.text()).to.contain("to submit their secret bids");
    wrapper.destroy();
  });

  it("shows the 'how does the auction work?' button during ban/pick/bid, and opens the explainer", async () => {
    const wrapper = mountFor(silentAuctionEngine());

    const infoButton = wrapper.find(".setup-status__info");
    expect(infoButton.exists()).to.equal(true);
    expect(infoButton.text()).to.contain("How does the auction work?");

    await infoButton.trigger("click");
    await Vue.nextTick();

    expect(document.body.textContent).to.contain("How the Silent Auction works");
    expect(document.body.textContent).to.contain("Ban");

    wrapper.destroy();
  });

  it("offers the ban-phase explainer, not the auction one, when a non-auction game bans", () => {
    const engine = new Engine(["init 2 setup-status-ban"], { banPhase: true });
    expect(engine.phase).to.equal(Phase.SetupFactionBan);

    const wrapper = mountFor(engine);
    expect(wrapper.text()).to.contain("to ban a faction");
    expect(wrapper.text()).to.contain("What's the ban phase?");
    expect(wrapper.text()).to.not.contain("How does the auction work?");
    wrapper.destroy();
  });

  it("offers no explainer at all for a plain faction pick", () => {
    const engine = new Engine(["init 2 setup-status-plain"]);
    expect(engine.phase).to.equal(Phase.SetupFaction);

    const wrapper = mountFor(engine);
    expect(wrapper.text()).to.contain("to pick a faction");
    expect(wrapper.find(".setup-status__info").exists()).to.equal(false);
    wrapper.destroy();
  });

  it("renders nothing once round 1 has started", () => {
    const setup = mountFor(new Engine(["init 2 setup-status-round1"]));
    expect(setup.find(".setup-status").exists()).to.equal(true);
    setup.destroy();

    // The strip is a round-0 thing only - from round 1 on, Commands.vue's own status line and the
    // mobile sticky bar take over.
    const engine = new Engine(["init 2 setup-status-round1"]);
    (engine as any).round = 1;

    const wrapper = mountFor(engine);
    expect(wrapper.find(".setup-status").exists()).to.equal(false);
    expect(wrapper.text()).to.equal("");
    wrapper.destroy();
  });
});
