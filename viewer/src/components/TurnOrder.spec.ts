import Engine, { Faction } from "@gaia-project/engine";
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
