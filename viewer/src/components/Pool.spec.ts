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
    black_user: null,
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
    claim: async () => undefined,
    leave: async () => undefined,
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

describe("compact Pool chess mode", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("shows a no-layout-space corner switch and mirrors every shared backend mode change", async () => {
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
    expect(first.find(".pool-clickable").classes()).to.include("chess-source-hidden");
    expect(second.find(".pool-mode-toggle").attributes("aria-label")).to.equal("Show booster and federation tiles");

    await second.find(".pool-mode-toggle").trigger("click");
    await settle();
    expect(writes).to.deep.equal(["chess", "pool"]);
    expect(first.find(".pool-chess-overlay").exists()).to.equal(false);
    expect(second.find(".pool-chess-overlay").exists()).to.equal(false);

    first.destroy();
    second.destroy();
    expect(listeners.size).to.equal(0);
  });
});
