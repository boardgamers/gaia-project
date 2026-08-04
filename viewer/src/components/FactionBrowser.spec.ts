import Engine, { AuctionVariant, Command, Faction, Phase } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import FactionBrowser from "./FactionBrowser.vue";

Vue.use(BootstrapVue);

describe("FactionBrowser", () => {
  function mountFor(engine: Engine) {
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);
    return mount(FactionBrowser, { store, attachTo: document.body });
  }

  const banning = () => new Engine(["init 3 faction-browser"], { auction: AuctionVariant.Silent });

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
    const engine = new Engine(
      ["init 3 faction-browser", "p1 banFaction terrans", "p2 banFaction lantids", "p3 banFaction gleens"],
      { auction: AuctionVariant.Silent }
    );
    expect(engine.phase).to.equal(Phase.SetupFaction);

    const wrapper = mountFor(engine);
    expect(wrapper.text()).to.contain("Not your turn to pick");
    wrapper.destroy();
  });

  it("renders nothing outside the ban and pick phases", () => {
    const bidding = new Engine(
      [
        "init 3 faction-browser",
        "p1 banFaction terrans",
        "p2 banFaction lantids",
        "p3 banFaction gleens",
        "p1 faction itars",
        "p2 faction taklons",
        "p3 faction xenos",
      ],
      { auction: AuctionVariant.Silent }
    );
    expect(bidding.phase).to.equal(Phase.SetupSilentBid);

    const wrapper = mountFor(bidding);
    expect(wrapper.find(".faction-browser").exists()).to.equal(false);
    wrapper.destroy();
  });
});
