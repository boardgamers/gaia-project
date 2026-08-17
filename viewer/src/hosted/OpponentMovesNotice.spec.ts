import { Phase, PlayerEnum } from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import { expect } from "chai";
import BootstrapVue from "bootstrap-vue";
import Vue from "vue";
import { makeStore } from "../store";
import OpponentMovesNotice from "./OpponentMovesNotice.vue";

Vue.use(BootstrapVue);

function engineState(overrides: Record<string, unknown> = {}) {
  return {
    phase: Phase.RoundMove,
    newTurn: true,
    playerToMove: PlayerEnum.Player1,
    passedPlayers: [],
    players: [{}, {}, {}, {}],
    moveHistory: [
      "init 4 recap-test",
      "terrans up sci.",
      "xenos up nav.",
      "geodens action power4.",
      "nevlas pass booster3.",
    ],
    advancedLog: [
      { player: PlayerEnum.Player1, move: 1 },
      { player: PlayerEnum.Player2, move: 2 },
      { player: PlayerEnum.Player3, move: 3 },
      { player: PlayerEnum.Player4, move: 4 },
      { player: PlayerEnum.Player1 },
    ],
    ...overrides,
  };
}

/** The recap window as it stands after only Xenos has answered this seat's turn. */
function partialRotation(overrides: Record<string, unknown> = {}) {
  return engineState({
    playerToMove: PlayerEnum.Player2,
    moveHistory: ["init 4 recap-test", "terrans up sci.", "xenos up nav."],
    advancedLog: [
      { player: PlayerEnum.Player1, move: 1 },
      { player: PlayerEnum.Player2, move: 2 },
    ],
    ...overrides,
  });
}

describe("OpponentMovesNotice", () => {
  // The seen marks live in localStorage (turn-recap-seen.ts), which jsdom shares across every test
  // in this file - without this, one case's dismissal silently hides the next case's notice.
  beforeEach(() => window.localStorage.clear());

  function setup(overrides: Record<string, unknown> = {}) {
    const store = makeStore();
    store.commit("player", { index: PlayerEnum.Player1 });
    store.commit("receiveData", engineState(overrides));
    return { store, view: render(OpponentMovesNotice, { store }) };
  }

  it("joins every opponent turn into one dismissible recap", async () => {
    const { view } = setup();

    expect(view.getByText("Since your last turn:")).to.not.equal(null);
    expect(view.getByText("Xenos: up nav")).to.not.equal(null);
    expect(view.getByText("Geoden: PA4 +7c")).to.not.equal(null);
    expect(view.getByText("Nevlas: pass B3 (1q/2c)")).to.not.equal(null);
    expect(view.container.querySelectorAll(".opponent-moves-notice__container")).to.have.length(1);
    expect(view.container.querySelectorAll(".opponent-moves-notice__dismiss")).to.have.length(1);

    await fireEvent.click(view.getByLabelText("Dismiss opponents' moves"));

    expect(view.queryByText("Since your last turn:")).to.equal(null);
  });

  it("disappears automatically as soon as the player starts their turn", async () => {
    const { store, view } = setup();
    expect(view.getByText("Since your last turn:")).to.not.equal(null);

    store.commit("receiveData", engineState({ newTurn: false }));
    await Vue.nextTick();

    expect(view.queryByText("Since your last turn:")).to.equal(null);
  });

  it("stays dismissed when the same game is opened again with nothing played in between", async () => {
    const { view } = setup();
    await fireEvent.click(view.getByLabelText("Dismiss opponents' moves"));

    // A fresh mount against the very same position - re-entering the game, a reload, a reconnect
    // refetch. The dismissal is remembered, so nothing already read comes back.
    const { view: reopened } = setup();

    expect(reopened.queryByText("Since your last turn:")).to.equal(null);
  });

  it("recaps only the turns that arrived after the last dismissal", async () => {
    const store = makeStore();
    store.commit("player", { index: PlayerEnum.Player1 });
    store.commit("receiveData", partialRotation());
    const view = render(OpponentMovesNotice, { store });

    expect(view.getByText("Xenos: up nav")).to.not.equal(null);
    await fireEvent.click(view.getByLabelText("Dismiss opponents' moves"));
    expect(view.queryByText("Since your last turn:")).to.equal(null);

    store.commit(
      "receiveData",
      engineState({
        playerToMove: PlayerEnum.Player3,
        moveHistory: ["init 4 recap-test", "terrans up sci.", "xenos up nav.", "geodens action power4."],
        advancedLog: [
          { player: PlayerEnum.Player1, move: 1 },
          { player: PlayerEnum.Player2, move: 2 },
          { player: PlayerEnum.Player3, move: 3 },
        ],
      })
    );
    await Vue.nextTick();

    expect(view.getByText("Since your last turn:")).to.not.equal(null);
    expect(view.getByText("Geoden: PA4 +7c")).to.not.equal(null);
    expect(view.queryByText("Xenos: up nav")).to.equal(null);
  });

  it("adopts a dismissal recorded by the previous build's storage key", () => {
    // "<seat>:<index of my own last turn>" - all the old build stored, and all it needed to hide
    // the whole window. Honoured once so updating doesn't replay an already-dismissed recap.
    window.localStorage.setItem(`opponent-moves-notice-dismissed:${window.location.search}`, "0:1");

    const { view } = setup();

    expect(view.queryByText("Since your last turn:")).to.equal(null);
    expect(window.localStorage.getItem(`opponent-moves-notice-dismissed:${window.location.search}`)).to.equal(null);
  });

  it("does not recap moves for a player who has passed", () => {
    const { view } = setup({ passedPlayers: [PlayerEnum.Player1] });

    expect(view.queryByText("Since your last turn:")).to.equal(null);
  });
});
