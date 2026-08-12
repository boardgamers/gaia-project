import Engine, { AuctionVariant, Command, Faction, Phase } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import FactionBrowser from "./FactionBrowser.vue";

Vue.use(BootstrapVue);

describe("FactionBrowser", () => {
  function mountFor(engine: Engine, onTurn = false) {
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);
    return mount(FactionBrowser, { store, propsData: { onTurn }, attachTo: document.body });
  }

  const banning = () => new Engine(["init 3 faction-browser"], { auction: AuctionVariant.Silent });

  const bans = ["p1 banFaction terrans", "p2 banFaction lantids", "p3 banFaction gleens"];
  const picks = ["p1 faction itars", "p2 faction taklons", "p3 faction xenos"];

  const picking = (moves: string[] = []) =>
    new Engine(["init 3 faction-browser", ...bans, ...moves], { auction: AuctionVariant.Silent });

  it("offers every faction the player on turn is being offered", () => {
    const engine = banning();
    expect(engine.phase).to.equal(Phase.SetupFactionBan);

    const wrapper = mountFor(engine);
    const offered = engine.availableCommands.find((c) => c.name === Command.BanFaction)!.data as Faction[];
    expect(offered.length).to.be.greaterThan(1);
    const buttons = wrapper.findAll(".faction-browser__buttons .btn");

    expect(buttons.length).to.equal(offered.length);
    expect(wrapper.text()).to.contain("Not your turn to ban");
    wrapper.destroy();
  });

  it("opens a faction sheet with no way to commit a ban or pick", async () => {
    const wrapper = mountFor(banning());

    await wrapper.findAll(".faction-browser__buttons .btn").at(0).trigger("click");
    await Vue.nextTick();
    await Vue.nextTick();

    const modal = document.body.querySelector(".modal");
    expect(modal, "clicking a faction should open its sheet").to.not.equal(null);

    // stylesheets/planets.css defines every game colour variable (--res-ore, --res-power, ...) only
    // under `.gaia-viewer-game, .gaia-viewer-modal`. A bootstrap modal is appended to <body>, i.e.
    // outside `.gaia-viewer-game`, so without this class the faction board's icons resolve to black -
    // which is exactly what an owner screenshot caught. MoveButton's own modal carries it too.
    expect(
      document.body.querySelector(".modal-dialog")?.classList.contains("gaia-viewer-modal"),
      "the sheet modal must carry gaia-viewer-modal or its board renders without colours"
    ).to.equal(true);

    const footerButtons = Array.from(modal?.querySelectorAll(".modal-footer button") ?? []).map((b) =>
      (b.textContent ?? "").trim()
    );
    // The real picker's modal carries an "OK, I ban this one!"-style confirm; this one must not.
    expect(footerButtons).to.deep.equal(["Close"]);
    expect(wrapper.emitted("command")).to.equal(undefined);

    wrapper.destroy();
  });

  it("says 'pick' during the faction pick phase", () => {
    const engine = picking();
    expect(engine.phase).to.equal(Phase.SetupFaction);

    const wrapper = mountFor(engine);
    expect(wrapper.text()).to.contain("Not your turn to pick");
    wrapper.destroy();
  });

  it("keeps an already picked faction's sheet reachable", async () => {
    const engine = picking(["p1 faction itars"]);
    expect(engine.phase).to.equal(Phase.SetupFaction);

    const wrapper = mountFor(engine);
    const taken = wrapper.findAll(".faction-browser__taken .btn");
    expect(taken.length, "the one picked faction should still have a button").to.equal(1);
    expect(taken.at(0).text()).to.contain("Itars");
    // The picker itself no longer offers it, which is the whole point of the row.
    expect(engine.availableCommands.find((c) => c.name === Command.ChooseFaction)!.data as Faction[]).to.not.contain(
      Faction.Itars
    );

    await taken.at(0).trigger("click");
    await Vue.nextTick();
    await Vue.nextTick();
    expect(document.body.querySelector(".modal"), "clicking a picked faction should open its sheet").to.not.equal(null);
    wrapper.destroy();
  });

  it("shows the picked factions to the player on turn as well, without the offered list", () => {
    const wrapper = mountFor(picking(["p1 faction itars"]), true);

    expect(wrapper.findAll(".faction-browser__taken .btn").length).to.equal(1);
    // The real picker is on screen next to it in that case, so this must not repeat it.
    expect(wrapper.text()).to.not.contain("Not your turn");
    expect(wrapper.findAll(".faction-browser__buttons .btn").length).to.equal(1);
    wrapper.destroy();
  });

  it("names the player holding each picked faction", () => {
    const engine = picking(["p1 faction itars"]);
    engine.players[0].name = "Alice";

    const wrapper = mountFor(engine);
    expect(wrapper.find(".faction-browser__taken .btn").text()).to.contain("Alice");
    wrapper.destroy();
  });

  it("keeps the auctioned factions readable while an off-turn player waits out the bidding", () => {
    const bidding = picking(picks);
    expect(bidding.phase).to.equal(Phase.SetupSilentBid);

    const wrapper = mountFor(bidding);
    expect(wrapper.text()).to.contain("Up for auction");
    expect(wrapper.findAll(".faction-browser__taken .btn").length).to.equal(3);
    wrapper.destroy();
  });

  it("leaves the silent bid form alone for the player on turn", () => {
    // Commands.vue's bid form already carries a sheet button per faction there.
    const wrapper = mountFor(picking(picks), true);
    expect(wrapper.find(".faction-browser").exists()).to.equal(false);
    wrapper.destroy();
  });

  it("keeps the picked factions readable during a classic bidding auction, on turn included", () => {
    // The bid buttons there are plain "Bid 1 for terrans" labels with no sheet behind them, so the
    // player about to spend VP has nothing else to read the faction from.
    const engine = new Engine(
      ["init 2 faction-browser", "p1 faction terrans", "p2 faction xenos", "p1 bid terrans 0"],
      { auction: AuctionVariant.ChooseBid }
    );
    expect(engine.phase).to.equal(Phase.SetupAuction);

    const wrapper = mountFor(engine, true);
    expect(wrapper.text()).to.contain("Up for auction");
    expect(wrapper.findAll(".faction-browser__taken .btn").length).to.equal(2);
    // Holding a faction there is only holding the highest bid on it so far, and the faction nobody
    // has bid on yet is held by nobody.
    expect(wrapper.findAll(".faction-browser__taken .btn").at(0).text()).to.contain("Player 1 leads");
    expect(wrapper.findAll(".faction-browser__taken .btn").at(1).text()).to.not.contain("leads");
    wrapper.destroy();
  });

  it("renders nothing once setup has moved past the faction phases", () => {
    const building = new Engine(["init 2 faction-browser", "p1 faction terrans", "p2 faction xenos"]);
    expect(building.phase).to.equal(Phase.SetupBuilding);

    const wrapper = mountFor(building);
    expect(wrapper.find(".faction-browser").exists()).to.equal(false);
    wrapper.destroy();
  });
});
