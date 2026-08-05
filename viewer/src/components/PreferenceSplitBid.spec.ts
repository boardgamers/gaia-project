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
  const engine = new Engine([...PICKS], { auction: AuctionVariant.PreferenceSplit, auctionBudget: 40 });
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
    // No lock AND no backend - the offline case, where the seat on turn is the one to bid for.
    const { store } = biddingStore({ seat: null });
    const { container, emitted } = render(PreferenceSplitBid, { store });

    await fill(container, [20, 12, 6, 2]);
    await fireEvent.click(submitButton(container));

    expect(emitted().command[0]).to.deep.equal(["preferenceBid itars 20 taklons 12 xenos 6 terrans 2"]);
  });

  it("stays hidden outside the bid phase", () => {
    const engine = new Engine(["init 4 djfjjv4k"], { auction: AuctionVariant.PreferenceSplit, auctionBudget: 40 });
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PreferenceSplitBid, { store });
    expect(container.querySelector(".preference-split-bid")).to.equal(null);
  });

  it("renders in a hosted test game, where one account holds every seat and there is no seat lock", async () => {
    // seatToLock() returns null when mySeats covers the whole table, so `player` is null even
    // though this IS hosted play. Reading player.index alone used to leave the panel with no seat
    // and render nothing at all, while Commands.vue still told the user to use it.
    const { store, submitted } = biddingStore({ hosted: true, seat: null });
    const { container } = render(PreferenceSplitBid, { store });

    expect(inputs(container)).to.have.length(4);
    // It bids for the first seat that still owes a submission, and names whose split it is.
    expect(container.textContent).to.contain("Player 1");

    await fill(container, [20, 12, 6, 2]);
    await fireEvent.click(submitButton(container));

    expect(submitted).to.deep.equal([
      {
        seat: 0,
        bids: [
          { faction: "itars", points: 20 },
          { faction: "taklons", points: 12 },
          { faction: "xenos", points: 6 },
          { faction: "terrans", points: 2 },
        ],
      },
    ]);
  });

  it("walks a test game through the remaining seats, blanking the form each time", async () => {
    // Seats 0 and 1 are already in, so the form must be on seat 2 - with empty inputs, not seat 1's
    // numbers - and must still be a form rather than the waiting screen.
    const { store } = biddingStore({ hosted: true, seat: null, submittedSeats: [0, 1] });
    const { container } = render(PreferenceSplitBid, { store });

    expect(inputs(container)).to.have.length(4);
    expect(inputs(container).every((input) => input.value === "0")).to.equal(true);
    expect(container.textContent).to.contain("Player 3");
    expect(submitButton(container).disabled).to.equal(true);
  });

  it("shows the waiting screen in a test game only once every seat is in", () => {
    const { store } = biddingStore({ hosted: true, seat: null, submittedSeats: [0, 1, 2, 3] });
    const { container } = render(PreferenceSplitBid, { store });

    expect(inputs(container)).to.have.length(0);
    expect(container.textContent).to.contain("Everyone has submitted");
  });

  it("shows nothing to a spectator", () => {
    const { store } = biddingStore({ hosted: true, seat: -1 });
    const { container } = render(PreferenceSplitBid, { store });

    expect(container.querySelector(".preference-split-bid")).to.equal(null);
  });
});
