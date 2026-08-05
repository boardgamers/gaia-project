import Engine, { AuctionVariant } from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { SealedBidEntry } from "../hosted/types";
import { makeStore } from "../store";
import PreferenceSplitBid from "./PreferenceSplitBid.vue";

Vue.use(BootstrapVue);

const PICKS = ["init 4 djfjjv4k", "p1 faction itars", "p2 faction taklons", "p3 faction xenos", "p4 faction terrans"];

/** In the bid phase, with nobody having submitted yet. */
function biddingStore(options: { seat?: number | null; hosted?: boolean; submittedSeats?: number[] } = {}) {
  const engine = new Engine([...PICKS], { auction: AuctionVariant.PreferenceSplit });
  engine.generateAvailableCommandsIfNeeded();
  const store = makeStore();
  store.commit("receiveData", engine);
  if (options.seat !== undefined) {
    store.commit("player", options.seat === null ? null : { index: options.seat });
  }
  const submitted: { seat: number; bids: SealedBidEntry[] }[] = [];
  if (options.hosted) {
    store.commit("setSealedBidBackend", {
      submit: async (seat: number, bids: SealedBidEntry[]) => {
        submitted.push({ seat, bids });
      },
      refresh: async () => undefined,
    });
    store.commit("sealedBidStatus", {
      playerCount: 4,
      budget: 40,
      submittedSeats: options.submittedSeats ?? [],
    });
  }
  return { engine, store, submitted };
}

function inputs(container: Element): HTMLInputElement[] {
  return Array.from(container.querySelectorAll("input.preference-split-bid__input"));
}

async function fill(container: Element, points: number[]) {
  const fields = inputs(container);
  for (let i = 0; i < points.length; i++) {
    await fireEvent.update(fields[i], String(points[i]));
  }
}

function submitButton(container: Element): HTMLButtonElement {
  return container.querySelector(".preference-split-bid__submit") as HTMLButtonElement;
}

describe("PreferenceSplitBid", () => {
  it("offers one whole-number input per faction up for auction", () => {
    const { store } = biddingStore({ hosted: true, seat: 0 });
    const { container } = render(PreferenceSplitBid, { store });

    expect(inputs(container)).to.have.length(4);
    expect(inputs(container).every((input) => input.getAttribute("step") === "1")).to.equal(true);
    expect(inputs(container).every((input) => input.getAttribute("min") === "0")).to.equal(true);
    expect(container.textContent).to.contain("Split exactly");
  });

  it("shows allocated and remaining points, and only enables submit at exactly the budget", async () => {
    const { store } = biddingStore({ hosted: true, seat: 0 });
    const { container } = render(PreferenceSplitBid, { store });

    expect(submitButton(container).disabled).to.equal(true);
    expect(container.textContent).to.contain("Allocated");
    expect(container.textContent).to.contain("Remaining");

    // Under budget.
    await fill(container, [18, 12, 7, 2]);
    expect(container.textContent).to.contain("39");
    expect(submitButton(container).disabled).to.equal(true);

    // Over budget.
    await fill(container, [18, 12, 7, 5]);
    expect(submitButton(container).disabled).to.equal(true);

    // Exactly the budget - including a 0, which is legal.
    await fill(container, [18, 12, 10, 0]);
    expect(submitButton(container).disabled).to.equal(false);
  });

  it("submits the whole split through the sealed backend, never as a move", async () => {
    const { store, submitted } = biddingStore({ hosted: true, seat: 2 });
    const { container, emitted } = render(PreferenceSplitBid, { store });

    await fill(container, [18, 12, 7, 3]);
    await fireEvent.click(submitButton(container));

    expect(submitted).to.have.length(1);
    expect(submitted[0].seat).to.equal(2);
    expect(submitted[0].bids).to.deep.equal([
      { faction: "itars", points: 18 },
      { faction: "taklons", points: 12 },
      { faction: "xenos", points: 7 },
      { faction: "terrans", points: 3 },
    ]);
    // Nothing was emitted as a move: in hosted play the bid must never reach the move log yet.
    expect(emitted().command).to.equal(undefined);
  });

  it("renders for a seat the engine's turn pointer is not on - all four bid at once", () => {
    // The engine points at seat 0 during the bid phase; seat 3 must still get a form.
    const { store } = biddingStore({ hosted: true, seat: 3 });
    const { container } = render(PreferenceSplitBid, { store });

    expect(inputs(container)).to.have.length(4);
  });

  it("reports progress but no numbers once this seat has submitted", () => {
    const { store } = biddingStore({ hosted: true, seat: 1, submittedSeats: [0, 1] });
    const { container } = render(PreferenceSplitBid, { store });

    expect(inputs(container)).to.have.length(0);
    expect(container.textContent).to.contain("Your split is in");
    expect(container.textContent).to.contain("2 of 4 players have submitted");
  });

  it("falls back to an ordinary move in offline/hot-seat play, for the seat on turn", async () => {
    const { store } = biddingStore({ seat: null });
    const { container, emitted } = render(PreferenceSplitBid, { store });

    await fill(container, [20, 12, 6, 2]);
    await fireEvent.click(submitButton(container));

    expect(emitted().command[0]).to.deep.equal(["preferenceBid itars 20 taklons 12 xenos 6 terrans 2"]);
  });

  it("stays hidden outside the bid phase", () => {
    const engine = new Engine(["init 4 djfjjv4k"], { auction: AuctionVariant.PreferenceSplit });
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PreferenceSplitBid, { store });
    expect(container.querySelector(".preference-split-bid")).to.equal(null);
  });
});
