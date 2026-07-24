/* eslint-disable @typescript-eslint/camelcase */
import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { makeStore } from "../store";
import { ChessBackend, ChessPanelMode, ChessRow } from "../logic/chess-backend";
import { START_FEN } from "../logic/chess";
import Pool from "./Pool.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function sharedBackend(initialMode: ChessPanelMode) {
  let row: ChessRow = {
    fen: START_FEN,
    white_user: null,
    white_user_2: null,
    black_user: null,
    black_user_2: null,
    white_next_user: null,
    black_next_user: null,
    panel_mode: initialMode,
  };
  const listeners = new Set<(next: ChessRow) => void>();
  const writes: ChessPanelMode[] = [];
  const backend: ChessBackend = {
    gameId: "game-one",
    userId: "user-one",
    load: async () => row,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    move: async (_before, after) => after,
    reset: async () => undefined,
    async setPanelMode(mode) {
      writes.push(mode);
      row = { ...row, panel_mode: mode };
      for (const listener of listeners) {
        listener(row);
      }
    },
  };
  return { backend, listeners, writes };
}

function mountPool(backend: ChessBackend | null) {
  const store = makeStore();
  store.state.data = new Engine(["init 2 shared-panel-mode"], { lostFleet: true });
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

  it("shows an inset corner switch and mirrors every shared backend mode change", async () => {
    const { backend, listeners, writes } = sharedBackend("pool");
    const first = mountPool(backend);
    const second = mountPool(backend);
    await settle();

    expect(listeners.size).to.equal(2);
    const firstSource = first.find(".pool-clickable").element;
    expect(first.find(".pool-mode-toggle").attributes("aria-label")).to.equal("Show shared chess board");
    expect(first.find(".pool-chess-overlay").exists()).to.equal(false);

    await first.find(".pool-mode-toggle").trigger("click");
    await settle();
    expect(writes).to.deep.equal(["chess"]);
    expect(first.find(".pool-chess-overlay").exists()).to.equal(true);
    expect(second.find(".pool-chess-overlay").exists()).to.equal(true);
    expect(first.find(".pool-clickable").element).to.equal(firstSource);
    expect(first.find(".pool-clickable").attributes("aria-hidden")).to.equal("true");
    expect(second.find(".pool-mode-toggle").attributes("aria-label")).to.equal("Show booster and federation tiles");

    await second.find(".pool-mode-toggle").trigger("click");
    await settle();
    expect(writes).to.deep.equal(["chess", "pool"]);
    expect((first.vm as any).showChess).to.equal(false);
    expect((second.vm as any).showChess).to.equal(false);
    expect(first.find(".pool-chess-overlay").attributes("aria-hidden")).to.equal("true");

    first.destroy();
    second.destroy();
    expect(listeners.size).to.equal(0);
  });

  it("toggles on either horizontal swipe and consumes each swipe's synthetic click", async () => {
    const { backend, writes } = sharedBackend("pool");
    const wrapper = mountPool(backend);
    await settle();

    const source = wrapper.find(".pool-clickable").element;
    dispatchPointer(source, "pointerdown", 130, 30);
    dispatchPointer(source, "pointermove", 70, 32);
    dispatchPointer(source, "pointerup", 70, 32);
    source.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();

    expect(writes).to.deep.equal(["chess"]);
    expect(wrapper.find(".pool-chess-overlay").exists()).to.equal(true);

    const board = wrapper.find(".chess-board-stub").element;
    dispatchPointer(board, "pointerdown", 40, 30, 2);
    dispatchPointer(board, "pointermove", 105, 28, 2);
    dispatchPointer(board, "pointerup", 105, 28, 2);
    board.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();

    expect(writes).to.deep.equal(["chess", "pool"]);
    expect((wrapper.vm as any).showChess).to.equal(false);
    wrapper.destroy();
  });

  it("moves both drawer faces with the pointer before committing shared state", async () => {
    const { backend, writes } = sharedBackend("pool");
    const wrapper = mountPool(backend);
    await settle();
    const source = wrapper.find(".pool-clickable").element;

    dispatchPointer(source, "pointerdown", 120, 30);
    dispatchPointer(source, "pointermove", 82, 31);
    await wrapper.vm.$nextTick();

    expect(writes).to.deep.equal([]);
    expect((wrapper.vm as any).panelSwipeActive).to.equal(true);
    expect(wrapper.find(".pool-clickable").attributes("style")).to.include("-38px");
    expect(wrapper.find(".pool-chess-overlay").attributes("style")).to.include("100%");
    expect(wrapper.find(".pool-chess-overlay").attributes("style")).to.include("-38px");

    dispatchPointer(source, "pointerup", 82, 31);
    await settle();
    expect(writes).to.deep.equal(["chess"]);
    wrapper.destroy();
  });

  it("ignores short and mostly vertical gestures", async () => {
    const { backend, writes } = sharedBackend("pool");
    const wrapper = mountPool(backend);
    await settle();
    const source = wrapper.find(".pool-clickable").element;

    dispatchPointer(source, "pointerdown", 100, 20);
    dispatchPointer(source, "pointermove", 75, 22);
    dispatchPointer(source, "pointerup", 75, 22);
    dispatchPointer(source, "pointerdown", 100, 20, 2);
    dispatchPointer(source, "pointermove", 115, 85, 2);
    dispatchPointer(source, "pointerup", 115, 85, 2);
    await settle();

    expect(writes).to.deep.equal([]);
    expect((wrapper.vm as any).showChess).to.equal(false);
    expect(wrapper.find(".pool-chess-overlay").attributes("aria-hidden")).to.equal("true");
    wrapper.destroy();
  });
});
