import Engine, { AuctionVariant } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import Charts from "./Charts.vue";

Vue.use(BootstrapVue);

describe("Charts", () => {
  it("does not show the Silent Auction log for a standard (non-auction) game", () => {
    const engine = new Engine(["init 2 djfjjv4k", "p1 faction terrans", "p2 faction itars"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Charts, { store });

    expect(container.querySelector(".silent-auction-log")).to.equal(null);
  });

  it("shows the Silent Auction log for a game that used the Silent Auction variant", () => {
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

    const { container } = render(Charts, { store });

    expect(container.querySelector(".silent-auction-log")).to.not.equal(null);
  });

  it("puts the Silent Auction log in its own tab, not the default one", async () => {
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

    const { container } = render(Charts, { store });
    await Vue.nextTick();
    await Vue.nextTick();

    const tabLinks = [...container.querySelectorAll(".nav-link")];
    expect(tabLinks.map((el) => el.textContent.trim())).to.deep.equal(["Statistics", "Silent Auction"]);
    expect(tabLinks[0].classList.contains("active"), "Statistics tab should be active by default").to.equal(true);
    expect(tabLinks[1].classList.contains("active"), "Silent Auction tab should not be active by default").to.equal(
      false
    );
  });
});
