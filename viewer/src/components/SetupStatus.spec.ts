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

  /** One "mark name" chip per seat, in seat order. */
  function roster(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper.findAll(".setup-status__chip").wrappers.map((chip) => chip.text().replace(/\s+/g, " ").trim());
  }

  it("tracks who has banned already, seat by seat", () => {
    const engine = silentAuctionEngine(["p1 banFaction terrans"]);
    engine.players[0].name = "Mark";
    engine.players[1].name = "Ada";
    engine.players[2].name = "Bo";

    const wrapper = mountFor(engine);
    // Mark is done, Ada is the one everybody is waiting on, Bo has not been asked yet.
    expect(roster(wrapper)).to.deep.equal(["✔ Mark", "▸ Ada", "· Bo"]);
    expect(wrapper.text()).to.contain("Bans");
    expect(wrapper.text()).to.contain("1 of 3 in");
    wrapper.destroy();
  });

  it("tracks who has picked a faction", () => {
    const engine = silentAuctionEngine([
      "p1 banFaction terrans",
      "p2 banFaction lantids",
      "p3 banFaction gleens",
      "p1 faction itars",
    ]);
    expect(engine.phase).to.equal(Phase.SetupFaction);

    const wrapper = mountFor(engine);
    // A player with a faction is named by it once they have one, which is also the "done" signal.
    expect(roster(wrapper)).to.deep.equal(["✔ Itars", "▸ Player 2", "· Player 3"]);
    expect(wrapper.text()).to.contain("Picks");
    expect(wrapper.text()).to.contain("1 of 3 in");
    wrapper.destroy();
  });

  it("tracks who has submitted their secret bids, without ever showing the bids", () => {
    const engine = silentAuctionEngine([
      "p1 banFaction terrans",
      "p2 banFaction lantids",
      "p3 banFaction gleens",
      "p1 faction itars",
      "p2 faction taklons",
      "p3 faction xenos",
      "p1 silentBid itars 17 taklons 4 xenos 0",
    ]);
    expect(engine.phase).to.equal(Phase.SetupSilentBid);

    const wrapper = mountFor(engine);
    expect(roster(wrapper)).to.deep.equal(["✔ Itars", "▸ Taklons", "· Xenos"]);
    expect(wrapper.text()).to.contain("Secret bids");
    expect(wrapper.text()).to.contain("1 of 3 in");
    // The one thing this must never leak.
    expect(wrapper.text()).to.not.contain("17");
    wrapper.destroy();
  });

  it("marks the viewer's own seat and explains each chip for a screen reader", () => {
    const engine = silentAuctionEngine(["p1 banFaction terrans"]);
    engine.players[1].name = "Ada";

    const wrapper = mountFor(engine, 1);
    const chips = wrapper.findAll(".setup-status__chip");
    expect(chips.at(0).classes()).to.contain("setup-status__chip--done");
    expect(chips.at(0).attributes("aria-label")).to.equal("Player 1 has banned a faction");
    expect(chips.at(1).classes()).to.contain("setup-status__chip--mine");
    expect(chips.at(1).attributes("aria-label")).to.equal("Ada has not banned yet");
    wrapper.destroy();
  });

  it("offers no roster where 'done' is not a state: the ascending auction and the booster round", () => {
    // Choose-Then-Bid: a player bids, gets outbid, bids again - there is nothing to tick off.
    const auction = new Engine(["init 2 setup-status-cb", "p1 faction terrans", "p2 faction xenos"], {
      auction: AuctionVariant.ChooseBid,
    });
    expect(auction.phase).to.equal(Phase.SetupAuction);
    let wrapper = mountFor(auction);
    expect(wrapper.text()).to.contain("to bid on a faction");
    expect(roster(wrapper)).to.deep.equal([]);
    wrapper.destroy();

    // And the starting-building round, where a player owes two placements rather than one.
    const buildings = new Engine(["init 2 setup-status-build", "p1 faction terrans", "p2 faction xenos"]);
    expect(buildings.phase).to.equal(Phase.SetupBuilding);
    wrapper = mountFor(buildings);
    expect(wrapper.text()).to.contain("starting buildings");
    expect(roster(wrapper)).to.deep.equal([]);
    wrapper.destroy();
  });

  it("leaves the Preference Split bid phase to its own panel, which already has a roster", () => {
    const engine = new Engine(
      ["init 3 setup-status-ps", "p1 faction itars", "p2 faction taklons", "p3 faction xenos"],
      { auction: AuctionVariant.PreferenceSplit, auctionBudget: 60 }
    );
    expect(engine.phase).to.equal(Phase.SetupPreferenceBid);

    // Hot-seat: the strip itself still shows (the device really is passed around), but the roster
    // belongs to PreferenceSplitBid.vue - two on one screen would just be noise.
    const wrapper = mountFor(engine);
    expect(wrapper.text()).to.contain("to split their bid points");
    expect(roster(wrapper)).to.deep.equal([]);
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
