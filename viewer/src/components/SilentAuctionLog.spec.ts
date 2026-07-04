import Engine, { AuctionVariant, Faction } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import SilentAuctionLog from "./SilentAuctionLog.vue";

Vue.use(BootstrapVue);

describe("SilentAuctionLog", () => {
  it("shows the bans, picks, bid matrix, resolution trace, and final result", () => {
    const engine = new Engine(
      [
        "init 3 djfjjv4k",
        "p1 banFaction terrans",
        "p2 banFaction lantids",
        "p3 banFaction hadsch-hallas",
        "p1 faction itars",
        "p2 faction xenos",
        "p3 faction taklons",
        "p1 silentBid itars 15 xenos 0 taklons 10",
        "p2 silentBid itars 15 xenos 5 taklons 8",
        "p3 silentBid itars 7 xenos 0 taklons 0",
      ],
      { auction: AuctionVariant.Silent }
    );

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SilentAuctionLog, { store });
    const text = container.textContent ?? "";

    expect(text).to.contain("Terrans");
    expect(text).to.contain("Lantids");
    expect(text).to.contain("Hadsch Hallas");

    expect(text).to.contain("Itars");
    expect(text).to.contain("Xenos");
    expect(text).to.contain("Taklons");

    // final result: p1 wins Taklons for 2, p2 wins Itars for 8, p3 wins Xenos for 0
    expect(engine.players[0].faction).to.equal(Faction.Taklons);
    expect(engine.players[0].data.bid).to.equal(2);

    const rows = Array.from(container.querySelectorAll("tbody tr")).map((row) => row.textContent);
    expect(rows.some((row) => row?.includes("Taklons") && row?.includes("2"))).to.equal(true);
  });
});
