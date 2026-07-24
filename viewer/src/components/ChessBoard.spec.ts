/* eslint-disable @typescript-eslint/camelcase */
// Fake hosted rows mirror Supabase column names.
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { ChessBackend, ChessRow } from "../logic/chess-backend";
import { createChess } from "../logic/chess-lib";
import { localChessStorageKey, START_FEN } from "../logic/chess";
import ChessBoard from "./ChessBoard.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function storeWith(chessBackend: ChessBackend | null) {
  return new Vuex.Store({ state: { chessBackend } });
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fenAfterE4(): string {
  const chess = createChess(START_FEN);
  chess.move({ from: "e2", to: "e4" });
  return chess.fen();
}

describe("ChessBoard", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("persists per-game offline moves, rotates to the next side, and never closes from a piece click", async () => {
    window.history.pushState({}, "", "/?offline=1&game=offline-one");
    const wrapper = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();

    await wrapper.find('[data-square="e2"]').trigger("click");
    await wrapper.find('[data-square="e4"]').trigger("click");
    await wrapper.vm.$nextTick();

    const stored = window.localStorage.getItem(localChessStorageKey(window.location.search)) ?? "";
    expect(stored.split(" ")[1]).to.equal("b");
    expect(wrapper.findAll(".lf-chess-square").at(0).attributes("data-square")).to.equal("h1");
    expect(wrapper.emitted("close")).to.equal(undefined);
    wrapper.destroy();
  });

  it("restores only the current offline Gaia game's chess position", async () => {
    window.history.pushState({}, "", "/?offline=1&game=offline-one");
    window.localStorage.setItem(localChessStorageKey(window.location.search), fenAfterE4());
    const first = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();
    expect((first.vm as any).fen).to.equal(fenAfterE4());
    first.destroy();

    window.history.pushState({}, "", "/?offline=1&game=offline-two");
    const second = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();
    expect((second.vm as any).fen).to.equal(START_FEN);
    second.destroy();
  });

  it("keeps an online player's own colour at the bottom and persists through the injected game backend", async () => {
    const moves: Array<[string, string]> = [];
    const row: ChessRow = { fen: START_FEN, white_user: "user-white", black_user: "user-black" };
    const backend: ChessBackend = {
      gameId: "game-one",
      userId: "user-white",
      load: async () => row,
      subscribe: () => () => undefined,
      claim: async () => undefined,
      leave: async () => undefined,
      move: async (before, after) => {
        moves.push([before, after]);
        return after;
      },
      reset: async () => undefined,
    };
    const wrapper = mount(ChessBoard as any, { localVue, store: storeWith(backend) });
    await flush();

    await wrapper.find('[data-square="e2"]').trigger("click");
    await wrapper.find('[data-square="e4"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(moves).to.have.length(1);
    expect(moves[0][0]).to.equal(START_FEN);
    expect(moves[0][1].split(" ")[1]).to.equal("b");
    expect(wrapper.findAll(".lf-chess-square").at(0).attributes("data-square")).to.equal("a8");
    wrapper.destroy();
  });

  it("opens a confirmation on long press and resets the local board only after confirmation", async () => {
    window.history.pushState({}, "", "/?offline=1&game=offline-reset");
    window.localStorage.setItem(localChessStorageKey(window.location.search), fenAfterE4());
    const wrapper = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();

    (wrapper.vm as any).onPointerDown({ clientX: 10, clientY: 10 });
    await new Promise((resolve) => setTimeout(resolve, 620));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".lf-chess-confirm-text").text()).to.equal("Reset the chess board?");

    await wrapper.find(".lf-chess-confirm-actions .danger").trigger("click");
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).fen).to.equal(START_FEN);
    expect(window.localStorage.getItem(localChessStorageKey(window.location.search))).to.equal(START_FEN);
    wrapper.destroy();
  });
});
