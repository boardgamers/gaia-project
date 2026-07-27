/* eslint-disable @typescript-eslint/camelcase */
import Engine, { Round } from "@gaia-project/engine";
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { makeStore } from "../store";
import { ChessBackend, ChessRow } from "../logic/chess-backend";
import { START_FEN } from "../logic/chess";
import Pool from "./Pool.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

// A hosted game's backend. The chess POSITION is shared through it; which face a viewer is looking
// at deliberately is not, so this test double has no panel-mode write at all - the component may
// only ever reach localStorage for that.
function hostedBackend(userId = "user-one") {
  const row: ChessRow = {
    fen: START_FEN,
    white_user: null,
    white_user_2: null,
    black_user: null,
    black_user_2: null,
    white_next_user: null,
    black_next_user: null,
  };
  const listeners = new Set<(next: ChessRow) => void>();
  const backend: ChessBackend = {
    gameId: "game-one",
    userId,
    load: async () => row,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    move: async (_before, after) => after,
    reset: async () => undefined,
  };
  return { backend, listeners };
}

function mountPool(backend: ChessBackend | null, inGame = false) {
  const store = makeStore();
  const engine = new Engine(["init 2 shared-panel-mode"], { lostFleet: true });
  engine.round = inGame ? Round.Round1 : Round.None;
  store.state.data = engine;
  store.commit("setChessBackend", backend);
  return mount(Pool as any, {
    localVue,
    store,
    propsData: { compact: true },
    stubs: {
      Booster: { template: '<div class="booster-stub" />' },
      FederationTile: { template: '<div class="federation-stub" />' },
      ChessBoard: { template: '<div class="chess-board-stub" />' },
    },
  });
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function dispatchPointer(element: Element, type: string, clientX: number, clientY: number, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    isPrimary: { value: true },
    pointerId: { value: pointerId },
  });
  element.dispatchEvent(event);
}

describe("compact Pool chess mode", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("shows subtle page dots and switches the face they select", async () => {
    const { backend } = hostedBackend();
    const wrapper = mountPool(backend);
    await settle();

    const source = wrapper.find(".pool-tiles-face").element;
    expect(wrapper.findAll(".pool-mode-dot")).to.have.length(2);
    expect(wrapper.find('[data-mode="pool"]').attributes("aria-pressed")).to.equal("true");
    expect(wrapper.find('[data-mode="chess"]').attributes("aria-label")).to.equal("Show shared chess board");
    expect(wrapper.find(".pool-mode-toggle").exists()).to.equal(false);
    expect(wrapper.find(".pool-chess-overlay").exists()).to.equal(false);

    await wrapper.find('[data-mode="chess"]').trigger("click");
    await settle();
    expect(wrapper.find(".pool-chess-overlay").exists()).to.equal(true);
    // The tile tree is never torn down or re-created by a face switch.
    expect(wrapper.find(".pool-tiles-face").element).to.equal(source);
    expect(wrapper.find(".pool-tiles-face").attributes("aria-hidden")).to.equal("true");
    expect(wrapper.find('[data-mode="chess"]').attributes("aria-pressed")).to.equal("true");

    await wrapper.find('[data-mode="pool"]').trigger("click");
    await settle();
    expect((wrapper.vm as any).showChess).to.equal(false);
    expect(wrapper.find(".pool-chess-overlay").attributes("aria-hidden")).to.equal("true");
    wrapper.destroy();
  });

  it("keeps each viewer's face to themselves in a hosted game", async () => {
    // Owner request: the minigame must not be shared state - one player swiping to chess used to
    // drag every other viewer's sidebar along with them.
    window.history.pushState({}, "", "/?game=hosted-one");
    const mine = mountPool(hostedBackend().backend);
    const theirs = mountPool(hostedBackend("user-two").backend);
    await settle();

    await mine.find('[data-mode="chess"]').trigger("click");
    await settle();
    expect((mine.vm as any).showChess).to.equal(true);
    expect((theirs.vm as any).showChess).to.equal(false);
    mine.destroy();
    theirs.destroy();
  });

  it("remembers the chosen face per hosted game and per account, across leaving and re-entering", async () => {
    window.history.pushState({}, "", "/?game=hosted-one");
    const wrapper = mountPool(hostedBackend().backend);
    await settle();
    await wrapper.find('[data-mode="chess"]').trigger("click");
    await settle();
    wrapper.destroy(); // leave the game...

    const reopened = mountPool(hostedBackend().backend); // ...and come back
    await settle();
    expect((reopened.vm as any).showChess).to.equal(true);
    reopened.destroy();

    // A different account on the same browser, and the same account in a different game, both start
    // from their own default rather than inheriting this one.
    const otherAccount = mountPool(hostedBackend("user-two").backend);
    await settle();
    expect((otherAccount.vm as any).showChess).to.equal(false);
    otherAccount.destroy();

    window.history.pushState({}, "", "/?game=hosted-two");
    const otherGame = mountPool(hostedBackend().backend);
    await settle();
    expect((otherGame.vm as any).showChess).to.equal(false);
    otherGame.destroy();
  });

  it("does not switch views when a booster or federation tile is tapped", async () => {
    const { backend } = hostedBackend();
    const wrapper = mountPool(backend, true);
    await settle();

    await wrapper.find(".booster-stub").trigger("click");
    await wrapper.find(".federation-stub").trigger("click");
    await settle();

    expect((wrapper.vm as any).showChess).to.equal(false);
    wrapper.destroy();
  });

  it("keeps one extra tile gap below the federation grid instead of a double-height bottom margin", () => {
    const wrapper = mountPool(null, true);
    expect(wrapper.find(".pool-federations").attributes("data-bottom-clearance")).to.equal("single-gap");
    wrapper.destroy();
  });

  it("toggles on either horizontal swipe and consumes each swipe's synthetic click", async () => {
    const { backend } = hostedBackend();
    const wrapper = mountPool(backend);
    await settle();

    const source = wrapper.find(".pool-tiles-face").element;
    dispatchPointer(source, "pointerdown", 130, 30);
    dispatchPointer(source, "pointermove", 70, 32);
    dispatchPointer(source, "pointerup", 70, 32);
    source.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();

    expect((wrapper.vm as any).showChess).to.equal(true);
    expect(wrapper.find(".pool-chess-overlay").exists()).to.equal(true);

    const board = wrapper.find(".chess-board-stub").element;
    dispatchPointer(board, "pointerdown", 40, 30, 2);
    dispatchPointer(board, "pointermove", 105, 28, 2);
    dispatchPointer(board, "pointerup", 105, 28, 2);
    board.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();

    expect((wrapper.vm as any).showChess).to.equal(false);
    wrapper.destroy();
  });

  it("moves both drawer faces with the pointer before committing the switch", async () => {
    const { backend } = hostedBackend();
    const wrapper = mountPool(backend);
    await settle();
    const source = wrapper.find(".pool-tiles-face").element;

    dispatchPointer(source, "pointerdown", 120, 30);
    dispatchPointer(source, "pointermove", 82, 31);
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).showChess).to.equal(false);
    expect((wrapper.vm as any).panelSwipeActive).to.equal(true);
    expect(wrapper.find(".pool-tiles-face").attributes("style")).to.include("-38px");
    expect(wrapper.find(".pool-chess-overlay").attributes("style")).to.include("100%");
    expect(wrapper.find(".pool-chess-overlay").attributes("style")).to.include("-38px");

    dispatchPointer(source, "pointerup", 82, 31);
    await settle();
    expect((wrapper.vm as any).showChess).to.equal(true);
    wrapper.destroy();
  });

  it("ignores short and mostly vertical gestures", async () => {
    const { backend } = hostedBackend();
    const wrapper = mountPool(backend);
    await settle();
    const source = wrapper.find(".pool-tiles-face").element;

    dispatchPointer(source, "pointerdown", 100, 20);
    dispatchPointer(source, "pointermove", 75, 22);
    dispatchPointer(source, "pointerup", 75, 22);
    dispatchPointer(source, "pointerdown", 100, 20, 2);
    dispatchPointer(source, "pointermove", 115, 85, 2);
    dispatchPointer(source, "pointerup", 115, 85, 2);
    await settle();

    expect((wrapper.vm as any).showChess).to.equal(false);
    expect(wrapper.find(".pool-chess-overlay").attributes("aria-hidden")).to.equal("true");
    wrapper.destroy();
  });
});
