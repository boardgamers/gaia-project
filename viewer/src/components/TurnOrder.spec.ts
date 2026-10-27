import Engine, { Faction, Phase } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import TurnOrder from "./TurnOrder.vue";

describe("TurnOrder presence dots", () => {
  const originalSearch = window.location.search;

  afterEach(() => {
    window.history.pushState({}, "", `${window.location.pathname}${originalSearch}`);
  });

  function engineWithTwoPlayers() {
    const engine = new Engine(["init 2 turn-order-presence"]);
    engine.players.forEach((pl, index) => {
      pl.faction = [Faction.Terrans, Faction.Lantids][index];
      pl.loadFaction(null, engine.expansions);
    });
    return engine;
  }

  it("renders no presence dot at all outside hosted mode (no ?game= in the URL)", () => {
    window.history.pushState({}, "", "/");
    const store = makeStore();
    store.commit("receiveData", engineWithTwoPlayers());

    const { container } = render(TurnOrder, { store });

    expect(container.querySelectorAll(".presence-dot").length).to.equal(0);
    expect(container.querySelectorAll(".player-circle__name").length).to.equal(2);
  });

  it("shows green for a seat actively focused on this exact game, grey for a seat with no presence at all", () => {
    window.history.pushState({}, "", "?game=game-1");
    const store = makeStore();
    store.commit("receiveData", engineWithTwoPlayers());
    // Only seat 0 has a known user/presence entry - seat 1 has neither (never signed in / no
    // presence tracked), which must fall back to grey rather than throwing.
    store.commit("seatUsers", { 0: "user-green" });
    store.commit("presence", {
      "user-green": [{ context: { type: "game", gameId: "game-1" }, focused: true }],
    });

    const { container } = render(TurnOrder, { store });

    const dots = container.querySelectorAll(".presence-dot");
    expect(dots.length).to.equal(2);
    expect(dots[0].classList.contains("green")).to.equal(true);
    expect(dots[1].classList.contains("grey")).to.equal(true);
  });

  it("shows yellow for a seat that's present but not focused on this exact game (lobby, another game, or a background tab of this one)", () => {
    window.history.pushState({}, "", "?game=game-1");
    const store = makeStore();
    store.commit("receiveData", engineWithTwoPlayers());
    store.commit("seatUsers", { 0: "user-lobby", 1: "user-other-game" });
    store.commit("presence", {
      "user-lobby": [{ context: { type: "lobby" }, focused: true }],
      "user-other-game": [{ context: { type: "game", gameId: "game-2" }, focused: true }],
    });

    const { container } = render(TurnOrder, { store });

    const dots = container.querySelectorAll(".presence-dot");
    expect(dots.length).to.equal(2);
    expect(dots[0].classList.contains("yellow")).to.equal(true);
    expect(dots[1].classList.contains("yellow")).to.equal(true);
  });
});

describe("TurnOrder passedPlayers (docs/lost-fleet/ANALYSIS_MODE_PLAN.md)", () => {
  it("marks a passed player with a pending charge as active alongside the turn player", () => {
    const engine = new Engine(["init 2 turn-order-pending-charge"], { concurrentCharges: true });
    engine.phase = Phase.RoundMove;
    engine.round = 1;
    engine.currentPlayer = 0;
    engine.turnOrder = [0];
    engine.passedPlayers = [1];
    engine.pendingCharges = [{ id: 1, player: 1, source: { player: 0, coordinates: "1A0" }, amount: 1 }];
    const store = makeStore();
    store.commit("receiveData", engine);
    const { container } = render(TurnOrder, { store });
    const circles = container.querySelectorAll<SVGCircleElement>(".player-token");
    expect(circles.length).to.equal(2);
    expect(circles[0].style.stroke).to.equal("rgb(34, 204, 68)");
    expect(circles[1].style.stroke).to.equal("rgb(34, 204, 68)");
    expect(circles[1].parentElement.style.opacity).to.equal("1");
    expect(circles[1].parentElement.querySelector("title").textContent).to.equal("Charge power");
  });

  it("never shows a passed player before round 1, even if passedPlayers is non-empty", () => {
    // Real games never populate `passedPlayers` before round 1 (only beginRoundStartPhase does,
    // once per round transition) - this fixture reproduces analysis mode's own setup-phase pre-seed
    // (applySoloRoundFlow), which is exactly the scenario that regressed without this guard: seat 0
    // visibly "passed" from the moment analysis mode was entered, before a single faction was
    // picked.
    const engine = new Engine(["init 2 turn-order-passed-guard"]);
    engine.passedPlayers = [0];
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(TurnOrder, { store });

    expect(container.querySelectorAll(".player-circle__name").length).to.equal(2);
  });

  it("shows a passed player once round 1 has genuinely started", () => {
    const engine = new Engine(["init 2 turn-order-passed-guard"]);
    engine.round = 1;
    engine.passedPlayers = [0];
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(TurnOrder, { store });

    expect(container.querySelectorAll(".player-circle__name").length).to.equal(3);
  });
});
