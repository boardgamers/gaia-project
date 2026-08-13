import Engine, { AuctionVariant, Faction } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import SilentAuctionLog from "./SilentAuctionLog.vue";

Vue.use(BootstrapVue);

describe("SilentAuctionLog", () => {
  function resolvedAuction() {
    return new Engine(
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
  }

  it("shows a compact result, draft, bid matrix, and complete resolution trail", () => {
    const engine = resolvedAuction();

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

    const resultCards = Array.from(container.querySelectorAll(".auction-result-card"));
    expect(resultCards).to.have.length(3);
    expect(resultCards.map((card) => card.getAttribute("data-turn-order"))).to.deep.equal(["1", "2", "3"]);

    const taklonsResult = resultCards.find((card) => card.textContent?.includes("Taklons"));
    expect(taklonsResult?.textContent).to.include("Player 1");
    expect(taklonsResult?.textContent).to.include("2");

    expect(container.querySelectorAll(".auction-draft__row")).to.have.length(3);
    expect(container.querySelectorAll("table")).to.have.length(1);
    expect(container.querySelectorAll(".auction-bids tbody tr")).to.have.length(3);
    expect(container.querySelectorAll(".auction-bids__winner")).to.have.length(3);
    expect(container.querySelectorAll(".auction-resolution__step")).to.have.length(engine.silentAuctionLog.length);
  });

  it("can omit its duplicate title inside the post-auction summary modal", () => {
    const store = makeStore();
    store.commit("receiveData", resolvedAuction());

    const { container } = render(SilentAuctionLog, { props: { hideTitle: true }, store });

    expect(container.querySelector(".silent-auction-log__header")).to.equal(null);
    expect(container.querySelectorAll(".auction-result-card")).to.have.length(3);
  });
});
