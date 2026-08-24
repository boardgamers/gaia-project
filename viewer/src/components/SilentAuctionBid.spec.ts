import Engine, { AuctionVariant } from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { SealedBidEntry } from "../logic/hosted-types";
import { makeStore } from "../store";
import SilentAuctionBid from "./SilentAuctionBid.vue";

Vue.use(BootstrapVue);

const PICKS = [
  "init 3 lf-silent-sealed",
  "p1 banFaction terrans",
  "p2 banFaction lantids",
  "p3 banFaction hadsch-hallas",
  "p1 faction itars",
  "p2 faction xenos",
  "p3 faction taklons",
];

/** In the secret-bid phase, with nobody having submitted yet unless `extraMoves` says otherwise. */
function biddingStore(
  options: {
    seat?: number | null;
    hosted?: boolean;
    submittedSeats?: number[];
    names?: string[];
    extraMoves?: string[];
  } = {}
) {
  const engine = new Engine([...PICKS, ...(options.extraMoves ?? [])], { auction: AuctionVariant.Silent });
  engine.generateAvailableCommandsIfNeeded();
  (options.names ?? []).forEach((name, index) => {
    engine.players[index].name = name;
  });
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
      playerCount: 3,
      variant: "silent",
      budget: null,
      maxBid: 40,
      submittedSeats: options.submittedSeats ?? [],
    });
  }
  return { engine, store, submitted };
}

function inputs(container: Element): HTMLInputElement[] {
  return Array.from(container.querySelectorAll("input.silent-auction-bid__input"));
}

async function fill(container: Element, points: number[]) {
  const fields = inputs(container);
  for (let i = 0; i < points.length; i++) {
    await fireEvent.update(fields[i], String(points[i]));
  }
}

function submitButton(container: Element): HTMLButtonElement {
  return container.querySelector(".silent-auction-bid__submit") as HTMLButtonElement;
}

/** One "name — state" line per seat, in seat order. */
function roster(container: Element): string[] {
  return Array.from(container.querySelectorAll(".silent-auction-bid__roster-row")).map((row) => {
    const name = row.querySelector(".silent-auction-bid__roster-name").textContent.trim();
    const state = row.querySelector(".silent-auction-bid__roster-state").textContent.trim();
    return `${name} — ${state}`;
  });
}

describe("SilentAuctionBid", () => {
  it("offers one bid input per faction up for auction, capped at the ceiling", () => {
    const { store } = biddingStore({ hosted: true, seat: 0 });
    const { container } = render(SilentAuctionBid, { store });

    expect(inputs(container)).to.have.length(3);
    expect(inputs(container).every((input) => input.getAttribute("min") === "0")).to.equal(true);
    expect(inputs(container).every((input) => input.getAttribute("max") === "40")).to.equal(true);
  });

  it("renders for a seat the engine's turn pointer is not on - every seat bids at once", () => {
    // The engine points at seat 0 during the bid phase; seat 2 must still get a form. This is the
    // whole change: before it, only the seat on turn could enter anything.
    const { store } = biddingStore({ hosted: true, seat: 2 });
    const { container } = render(SilentAuctionBid, { store });

    expect(inputs(container)).to.have.length(3);
  });

  it("submits the whole set of bids through the sealed backend, never as a move", async () => {
    const { store, submitted } = biddingStore({ hosted: true, seat: 2 });
    const { container, emitted } = render(SilentAuctionBid, { store });

    await fill(container, [15, 0, 10]);
    await fireEvent.click(submitButton(container));

    expect(submitted).to.have.length(1);
    expect(submitted[0].seat).to.equal(2);
    expect(submitted[0].bids).to.deep.equal([
      { faction: "itars", points: 15 },
      { faction: "xenos", points: 0 },
      { faction: "taklons", points: 10 },
    ]);
    // Nothing was emitted as a move: in hosted play a bid must never reach the move log yet.
    expect(emitted().command).to.equal(undefined);
  });

  it("refuses a bid above the ceiling, with the reason spelled out", async () => {
    // Unlike a budget split there is no running tally, so an illegal number needs saying out loud.
    const { store } = biddingStore({ hosted: true, seat: 0 });
    const { container } = render(SilentAuctionBid, { store });

    await fill(container, [41, 0, 0]);
    expect(submitButton(container).disabled).to.equal(true);
    expect(container.textContent).to.contain("cannot be higher than 40");

    await fill(container, [40, 0, 0]);
    expect(submitButton(container).disabled).to.equal(false);
  });

  it("accepts all-zero bids", async () => {
    // Legal, and meaningful: it says you would take any of them, but only for free.
    const { store, submitted } = biddingStore({ hosted: true, seat: 0 });
    const { container } = render(SilentAuctionBid, { store });

    expect(submitButton(container).disabled).to.equal(false);
    await fireEvent.click(submitButton(container));

    expect(submitted[0].bids.map((b) => b.points)).to.deep.equal([0, 0, 0]);
  });

  it("lists every seat's submission status while the form is still open", () => {
    // The whole point of showing it here rather than only afterwards: you can see, before you
    // submit, whether you are the one everybody is waiting for.
    const { store } = biddingStore({
      hosted: true,
      seat: 1,
      submittedSeats: [0],
      names: ["Ada", "Bo", "Cleo"],
    });
    const { container } = render(SilentAuctionBid, { store });

    expect(inputs(container)).to.have.length(3);
    expect(roster(container)).to.deep.equal([
      "Ada — Bids submitted",
      "Bo (you) — Still choosing",
      "Cleo — Still choosing",
    ]);
    expect(container.textContent).to.contain("1 of 3 in");
  });

  it("reports progress but no numbers once this seat has submitted", async () => {
    const { store } = biddingStore({ hosted: true, seat: 1, submittedSeats: [0] });
    const { container } = render(SilentAuctionBid, { store });

    await fill(container, [5, 4, 3]);
    await fireEvent.click(submitButton(container));

    expect(inputs(container)).to.have.length(0);
    expect(container.textContent).to.contain("Your bids are in");
    // The status poll runs every 5s, so it still says only seat 0 is in - this device's own
    // submission has to show up immediately regardless.
    expect(roster(container)[1]).to.equal("Player 2 (you) — Bids submitted");
    expect(container.textContent).to.contain("2 of 3 in");
    // ...and no bid of anybody's, least of all this seat's own, is anywhere on screen.
    expect(container.textContent).to.not.contain("5");
  });

  it("derives the roster from the recorded bids in offline/hot-seat play, where there is no status poll", () => {
    // No backend, so nothing to poll: a submitted set of bids is an ordinary move and the engine is
    // the only record of who has bid.
    const { store } = biddingStore({
      seat: null,
      extraMoves: ["p1 silentBid itars 15 xenos 0 taklons 10"],
    });
    const { container } = render(SilentAuctionBid, { store });

    expect(roster(container)).to.deep.equal([
      "Player 1 — Bids submitted",
      "Player 2 (you) — Still choosing",
      "Player 3 — Still choosing",
    ]);
  });

  it("falls back to an ordinary move in offline/hot-seat play, for the seat on turn", async () => {
    const { store } = biddingStore({ seat: null });
    const { container, emitted } = render(SilentAuctionBid, { store });

    await fill(container, [15, 0, 10]);
    await fireEvent.click(submitButton(container));

    expect(emitted().command[0]).to.deep.equal(["silentBid itars 15 xenos 0 taklons 10"]);
  });

  it("renders in a hosted test game, where one account holds every seat and there is no seat lock", async () => {
    // seatToLock() returns null when mySeats covers the whole table, so `player` is null even
    // though this IS hosted play - it means "all seats", asked for one at a time.
    const { store, submitted } = biddingStore({ hosted: true, seat: null });
    const { container } = render(SilentAuctionBid, { store });

    expect(container.textContent).to.contain("Player 1");
    await fill(container, [15, 0, 10]);
    await fireEvent.click(submitButton(container));

    expect(submitted).to.deep.equal([
      {
        seat: 0,
        bids: [
          { faction: "itars", points: 15 },
          { faction: "xenos", points: 0 },
          { faction: "taklons", points: 10 },
        ],
      },
    ]);
  });

  it("renders every seat during analysis mode, even with a real locked seat (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §2.6/decision #7)", async () => {
    const { store, submitted } = biddingStore({ hosted: true, seat: 0 });
    store.commit("setAnalysisMode", true);
    const { container } = render(SilentAuctionBid, { store });

    // Same "asked for each seat, one at a time" shape as the test-game (seat: null) case above -
    // analysis mode widens mySeats the same way, so this seat's own lock no longer narrows it.
    expect(container.textContent).to.contain("Player 1");
    await fill(container, [15, 0, 10]);
    await fireEvent.click(submitButton(container));

    expect(submitted).to.deep.equal([
      {
        seat: 0,
        bids: [
          { faction: "itars", points: 15 },
          { faction: "xenos", points: 0 },
          { faction: "taklons", points: 10 },
        ],
      },
    ]);
  });

  it("shows the waiting screen in a test game only once every seat is in", () => {
    const { store } = biddingStore({ hosted: true, seat: null, submittedSeats: [0, 1, 2] });
    const { container } = render(SilentAuctionBid, { store });

    expect(inputs(container)).to.have.length(0);
    expect(container.textContent).to.contain("Everyone has submitted");
  });

  it("shows nothing to a spectator", () => {
    const { store } = biddingStore({ hosted: true, seat: -1 });
    const { container } = render(SilentAuctionBid, { store });

    expect(container.querySelector(".silent-auction-bid")).to.equal(null);
  });

  it("stays hidden outside the bid phase", () => {
    const engine = new Engine(["init 3 lf-silent-sealed"], { auction: AuctionVariant.Silent });
    engine.generateAvailableCommandsIfNeeded();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(SilentAuctionBid, { store });
    expect(container.querySelector(".silent-auction-bid")).to.equal(null);
  });

  it("stays out of a hosted game that had already started bidding one seat at a time", () => {
    // A Silent Auction caught mid-round by the switch to sealed bidding finishes the way it
    // started, through Commands.vue's on-turn form - see logic/sealed-bid.ts. Offering the sealed
    // panel there would ask seats that are already in the move log to bid a second time.
    const { store } = biddingStore({
      hosted: true,
      seat: 1,
      extraMoves: ["p1 silentBid itars 15 xenos 0 taklons 10"],
    });
    const { container } = render(SilentAuctionBid, { store });

    expect(container.querySelector(".silent-auction-bid")).to.equal(null);
  });
});
