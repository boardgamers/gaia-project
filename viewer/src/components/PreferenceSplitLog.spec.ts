import Engine, { AuctionVariant } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import PreferenceSplitLog, { formatPrice } from "./PreferenceSplitLog.vue";

Vue.use(BootstrapVue);

/** The deterministic fixture from engine/src/preference-split-variant.spec.ts: no ties anywhere,
 * so every number this component renders is exactly assertable. */
const MOVES = [
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

function mount() {
  const engine = new Engine(MOVES, { auction: AuctionVariant.PreferenceSplit, auctionBudget: 40 });
  const store = makeStore();
  store.commit("receiveData", engine);
  return { engine, ...render(PreferenceSplitLog, { store }) };
}

describe("PreferenceSplitLog", () => {
  it("formats an exact average without trailing noise", () => {
    expect(formatPrice(12.75)).to.equal("12.75");
    expect(formatPrice(9)).to.equal("9");
    expect(formatPrice(8.75)).to.equal("8.75");
  });

  it("shows every original bid, each faction's total and average, and the resolved ranking", () => {
    const { container } = mount();
    const text = container.textContent ?? "";

    expect(text).to.contain("Itars");
    expect(text).to.contain("Taklons");
    expect(text).to.contain("Xenos");
    expect(text).to.contain("Terrans");

    const rows = Array.from(container.querySelectorAll("tbody tr")).map((row) => row.textContent ?? "");
    // Terrans: all four bids (2, 2, 22, 25), total 51, average 12.75.
    expect(rows.some((row) => row.includes("Terrans") && row.includes("51") && row.includes("12.75"))).to.equal(true);
    // Xenos: total 35, average 8.75 - still built from all four bids although it is awarded last.
    expect(rows.some((row) => row.includes("Xenos") && row.includes("35") && row.includes("8.75"))).to.equal(true);
  });

  it("explains each allocation and the price it produced", () => {
    const { container } = mount();
    const timeline = Array.from(container.querySelectorAll(".preference-split-log__timeline li")).map(
      (li) => li.textContent ?? ""
    );

    expect(timeline).to.have.length(4);
    expect(timeline[0]).to.contain("Terrans");
    expect(timeline[0]).to.contain("wins it with a bid of 25");
    expect(timeline[0]).to.contain("pays 13 VP");
    // The arithmetic is spelled out: the four bids, their average, the rounded payment.
    expect(timeline[0]).to.contain("2 + 2 + 22 + 25");
    expect(timeline[0]).to.contain("the average is 12.75");
    // Nothing was decided at random in this fixture.
    expect(timeline.every((step) => !step.includes("Random tiebreak"))).to.equal(true);
  });

  it("shows the winner's own bid, the average and the final VP payment", () => {
    const { container } = mount();
    const rows = Array.from(container.querySelectorAll("tbody tr")).map((row) => row.textContent ?? "");

    // Result table row for Itars: winner bid 20, average 9.5, pays 10.
    expect(rows.some((row) => row.includes("Itars") && row.includes("9.5") && row.includes("10"))).to.equal(true);
    // No "capped price" column any more - the average IS the price.
    expect(container.textContent).to.not.contain("Capped");
  });

  it("spells out when the average comes to more than the winner's own bid", () => {
    // itars totals 36 (average 9) but is ranked last, by which point only p4 - who bid 6 - is left.
    const engine = new Engine(
      [
        "init 4 djfjjv4k",
        "p1 faction itars",
        "p2 faction taklons",
        "p3 faction xenos",
        "p4 faction terrans",
        "p1 preferenceBid itars 22 taklons 14 xenos 2 terrans 2",
        "p2 preferenceBid itars 4 taklons 13 xenos 2 terrans 21",
        "p3 preferenceBid itars 4 taklons 12 xenos 22 terrans 2",
        "p4 preferenceBid itars 6 taklons 4 xenos 16 terrans 14",
      ],
      { auction: AuctionVariant.PreferenceSplit, auctionBudget: 40 }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PreferenceSplitLog, { store });
    const timeline = Array.from(container.querySelectorAll(".preference-split-log__timeline li")).map(
      (li) => li.textContent ?? ""
    );
    const itars = timeline.find((step) => step.startsWith("Itars")) ?? "";

    expect(itars).to.contain("pays 9 VP");
    expect(itars).to.contain("more than their own bid of 6");
    expect(itars).to.contain("what the table thought the faction was worth");
  });
});
