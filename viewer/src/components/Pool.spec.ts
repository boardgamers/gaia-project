/* eslint-disable @typescript-eslint/camelcase */
import Engine, { Round } from "@gaia-project/engine";
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
      return row;
    },
  };
  return { backend, listeners, writes };
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

  it("shows subtle page dots and mirrors every shared backend mode change", async () => {
    const { backend, listeners, writes } = sharedBackend("pool");
    const first = mountPool(backend);
    const second = mountPool(backend);
    await settle();

    expect(listeners.size).to.equal(2);
    const firstSource = first.find(".pool-tiles-face").element;
    expect(first.findAll(".pool-mode-dot")).to.have.length(2);
    expect(first.find('[data-mode="pool"]').attributes("aria-pressed")).to.equal("true");
    expect(first.find('[data-mode="chess"]').attributes("aria-label")).to.equal("Show shared chess board");
    expect(first.find(".pool-mode-toggle").exists()).to.equal(false);
    expect(first.find(".pool-chess-overlay").exists()).to.equal(false);

    await first.find('[data-mode="chess"]').trigger("click");
    await settle();
    expect(writes).to.deep.equal(["chess"]);
    expect(first.find(".pool-chess-overlay").exists()).to.equal(true);
    expect(second.find(".pool-chess-overlay").exists()).to.equal(true);
    expect(first.find(".pool-tiles-face").element).to.equal(firstSource);
    expect(first.find(".pool-tiles-face").attributes("aria-hidden")).to.equal("true");
    expect(second.find('[data-mode="chess"]').attributes("aria-pressed")).to.equal("true");

    await second.find('[data-mode="pool"]').trigger("click");
    await settle();
    expect(writes).to.deep.equal(["chess", "pool"]);
    expect((first.vm as any).showChess).to.equal(false);
    expect((second.vm as any).showChess).to.equal(false);
    expect(first.find(".pool-chess-overlay").attributes("aria-hidden")).to.equal("true");

    first.destroy();
    second.destroy();
    expect(listeners.size).to.equal(0);
  });

  it("does not let a slow initial four-player snapshot undo a completed swipe", async () => {
    const staleRow: ChessRow = {
      fen: START_FEN,
      updated_at: "2026-07-24T19:00:00.000Z",
      white_user: "white-one",
      white_user_2: "white-two",
      black_user: "black-one",
      black_user_2: "black-two",
      white_next_user: "white-one",
      black_next_user: "black-one",
      panel_mode: "pool",
    };
    const committedRow: ChessRow = {
      ...staleRow,
      updated_at: "2026-07-24T19:00:01.000Z",
      panel_mode: "chess",
    };
    let resolveInitial = (_row: ChessRow) => undefined;
    const backend: ChessBackend = {
      gameId: "four-player-game",
      userId: "white-one",
      load: () => new Promise((resolve) => (resolveInitial = resolve)),
      subscribe: () => () => undefined,
      move: async (_before, after) => after,
      reset: async () => undefined,
      setPanelMode: async () => committedRow,
    };
    const wrapper = mountPool(backend);

    const source = wrapper.find(".pool-tiles-face").element;
    dispatchPointer(source, "pointerdown", 130, 30);
    dispatchPointer(source, "pointermove", 70, 30);
    dispatchPointer(source, "pointerup", 70, 30);
    await settle();
    expect((wrapper.vm as any).showChess).to.equal(true);

    resolveInitial(staleRow);
    await settle();
    expect((wrapper.vm as any).showChess).to.equal(true);
    wrapper.destroy();
  });

  it("lets a spectator switch locally without changing shared state", async () => {
    let row: ChessRow = {
      fen: START_FEN,
      updated_at: "2026-07-24T19:00:00.000Z",
      white_user: "white",
      white_user_2: null,
      black_user: "black",
      black_user_2: null,
      white_next_user: "white",
      black_next_user: "black",
      panel_mode: "pool",
    };
    const listeners = new Set<(next: ChessRow) => void>();
    const backend: ChessBackend = {
      gameId: "spectated-game",
      userId: "spectator",
      load: async () => row,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      move: async (_before, after) => after,
      reset: async () => undefined,
      setPanelMode: async () => null,
    };
    const wrapper = mountPool(backend);
    await settle();

    const source = wrapper.find(".pool-tiles-face").element;
    dispatchPointer(source, "pointerdown", 130, 30);
    dispatchPointer(source, "pointermove", 70, 30);
    dispatchPointer(source, "pointerup", 70, 30);
    await settle();
    expect((wrapper.vm as any).showChess).to.equal(true);

    for (const listener of listeners) {
      listener(row);
    }
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).showChess).to.equal(true);

    row = { ...row, panel_mode: "pool", updated_at: "2026-07-24T19:00:01.000Z" };
    for (const listener of listeners) {
      listener(row);
    }
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).showChess).to.equal(false);
    wrapper.destroy();
  });

  it("does not switch views when a booster or federation tile is tapped", async () => {
    const { backend, writes } = sharedBackend("pool");
    const wrapper = mountPool(backend, true);
    await settle();

    await wrapper.find(".booster-stub").trigger("click");
    await wrapper.find(".federation-stub").trigger("click");
    await settle();

    expect(writes).to.deep.equal([]);
    expect((wrapper.vm as any).showChess).to.equal(false);
    wrapper.destroy();
  });

  it("keeps one extra tile gap below the federation grid instead of a double-height bottom margin", () => {
    const wrapper = mountPool(null, true);
    expect(wrapper.find(".pool-federations").attributes("data-bottom-clearance")).to.equal("single-gap");
    wrapper.destroy();
  });

  it("toggles on either horizontal swipe and consumes each swipe's synthetic click", async () => {
    const { backend, writes } = sharedBackend("pool");
    const wrapper = mountPool(backend);
    await settle();

    const source = wrapper.find(".pool-tiles-face").element;
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
    const source = wrapper.find(".pool-tiles-face").element;

    dispatchPointer(source, "pointerdown", 120, 30);
    dispatchPointer(source, "pointermove", 82, 31);
    await wrapper.vm.$nextTick();

    expect(writes).to.deep.equal([]);
    expect((wrapper.vm as any).panelSwipeActive).to.equal(true);
    expect(wrapper.find(".pool-tiles-face").attributes("style")).to.include("-38px");
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
    const source = wrapper.find(".pool-tiles-face").element;

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
