/* eslint-disable @typescript-eslint/camelcase */
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { RenjuBackend, RenjuRow } from "../logic/renju-backend";
import { EMPTY_RENJU_BOARD, RENJU_SIZE, localRenjuStorageKey } from "../logic/renju";
import RenjuBoard from "./RenjuBoard.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function at(row: number, column: number): number {
  return row * RENJU_SIZE + column;
}

function emptyRow(overrides: Partial<RenjuRow> = {}): RenjuRow {
  return {
    board: EMPTY_RENJU_BOARD,
    last_move: null,
    black_user: null,
    black_user_2: null,
    white_user: null,
    white_user_2: null,
    black_next_user: null,
    white_next_user: null,
    ...overrides,
  };
}

/** A shared in-memory board, standing in for the Supabase RPCs. */
function sharedBackend(initial: RenjuRow, userId = "user-black") {
  let row = initial;
  const listeners = new Set<(next: RenjuRow) => void>();
  const moves: { board: string; index: number }[] = [];
  const backend: RenjuBackend = {
    gameId: "game-one",
    userId,
    load: async () => row,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async move(_previous, next, index) {
      moves.push({ board: next, index });
      row = { ...row, board: next, last_move: index };
      for (const listener of listeners) {
        listener(row);
      }
      return next;
    },
    reset: async () => undefined,
  };
  return { backend, moves };
}

function mountBoard(backend: RenjuBackend | null, seatUsers: Record<number, string | null> = {}, names: string[] = []) {
  const store = new Vuex.Store({
    state: {
      renjuBackend: backend,
      seatUsers,
      data: { players: names.map((name) => ({ name })) },
    },
  });
  return mount(RenjuBoard as any, { localVue, store });
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function tap(wrapper: any, index: number) {
  await wrapper.findAll(".lf-renju-hit").at(index).trigger("click");
}

describe("RenjuBoard", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("renders a full 15x15 grid of intersections", async () => {
    const wrapper = mountBoard(null);
    await settle();
    expect(wrapper.findAll(".lf-renju-hit")).to.have.length(225);
    expect(wrapper.find(".lf-renju-status").text()).to.equal("Black to move");
    wrapper.destroy();
  });

  it("needs two taps to place a stone, and persists offline play per game", async () => {
    window.history.pushState({}, "", "/?offline=1&game=renju-one");
    const wrapper = mountBoard(null);
    await settle();

    await tap(wrapper, at(7, 7));
    expect(wrapper.findAll(".lf-renju-stone")).to.have.length(0);
    expect(wrapper.find(".lf-renju-ghost").exists()).to.equal(true);
    expect(wrapper.find(".lf-renju-status").text()).to.equal("Tap again to place");

    // A tap somewhere else moves the ghost rather than committing it.
    await tap(wrapper, at(7, 8));
    expect(wrapper.findAll(".lf-renju-stone")).to.have.length(0);

    await tap(wrapper, at(7, 8));
    expect(wrapper.findAll(".lf-renju-stone")).to.have.length(1);
    expect(wrapper.find(".lf-renju-stone").classes()).to.contain("black");
    // Offline is pass-and-play, so the same device now plays white.
    expect(wrapper.find(".lf-renju-status").text()).to.equal("White to move");

    const stored = JSON.parse(window.localStorage.getItem(localRenjuStorageKey("?offline=1&game=renju-one")) ?? "null");
    expect(stored.lastMove).to.equal(at(7, 8));
    expect(stored.board.charAt(at(7, 8))).to.equal("b");
    wrapper.destroy();
  });

  it("restores an offline position and marks the last stone", async () => {
    window.history.pushState({}, "", "/?offline=1&game=renju-two");
    const board = EMPTY_RENJU_BOARD.slice(0, at(3, 3)) + "b" + EMPTY_RENJU_BOARD.slice(at(3, 3) + 1);
    window.localStorage.setItem(
      localRenjuStorageKey("?offline=1&game=renju-two"),
      JSON.stringify({ board, lastMove: at(3, 3) })
    );
    const wrapper = mountBoard(null);
    await settle();
    expect(wrapper.findAll(".lf-renju-stone")).to.have.length(1);
    expect(wrapper.find(".lf-renju-last").exists()).to.equal(true);
    wrapper.destroy();
  });

  it("declares a winner on exactly five and stops accepting stones", async () => {
    const wrapper = mountBoard(null);
    await settle();
    // Black builds a row while white answers elsewhere.
    for (let i = 0; i < 5; i++) {
      await tap(wrapper, at(5, 2 + i));
      await tap(wrapper, at(5, 2 + i));
      if (i < 4) {
        await tap(wrapper, at(12, 2 + i));
        await tap(wrapper, at(12, 2 + i));
      }
    }
    expect(wrapper.find(".lf-renju-status").text()).to.equal("Black wins");
    expect(wrapper.find(".lf-renju-win-line").exists()).to.equal(true);
    expect(wrapper.findAll(".lf-renju-stone.winning")).to.have.length(5);

    const placed = wrapper.findAll(".lf-renju-stone").length;
    await tap(wrapper, at(0, 0));
    await tap(wrapper, at(0, 0));
    expect(wrapper.findAll(".lf-renju-stone")).to.have.length(placed);
    wrapper.destroy();
  });

  it("shows the same advantage meter the chess face does, pinned once the game is decided", async () => {
    const wrapper = mountBoard(null);
    await settle();

    const meter = wrapper.find(".lf-renju-eval");
    expect(meter.exists()).to.equal(true);
    expect(meter.attributes("role")).to.equal("meter");
    // Nothing has been searched yet on an empty board, so the meter starts level.
    expect(meter.attributes("aria-valuenow")).to.equal("50");
    expect(wrapper.find(".lf-renju-eval-white").attributes("style")).to.contain("50%");

    // Black builds a five while white answers elsewhere; the finished game pins the bar to black.
    for (let i = 0; i < 5; i++) {
      await tap(wrapper, at(5, 2 + i));
      await tap(wrapper, at(5, 2 + i));
      if (i < 4) {
        await tap(wrapper, at(12, 2 + i));
        await tap(wrapper, at(12, 2 + i));
      }
    }
    await settle();

    const decided = wrapper.find(".lf-renju-eval");
    expect(decided.attributes("aria-valuenow")).to.equal("0"); // 0% white = all black
    expect(decided.attributes("aria-valuetext")).to.equal("Black has five in a row");
    wrapper.destroy();
  });

  it("online, only the designated mover may play, and the shared board is mirrored", async () => {
    const { backend, moves } = sharedBackend(
      emptyRow({ black_user: "user-black", white_user: "user-white", black_next_user: "user-black" }),
      "user-black"
    );
    const black = mountBoard(backend, { 0: "user-black", 1: "user-white" }, ["Kim", "Sam"]);
    await settle();
    expect(black.find(".lf-renju-status").text()).to.equal("Kim to move");

    await tap(black, at(7, 7));
    await tap(black, at(7, 7));
    await settle();
    expect(moves).to.have.length(1);
    expect(moves[0].index).to.equal(at(7, 7));
    // White's turn now: this viewer is black, so further taps do nothing.
    expect(black.find(".lf-renju-status").text()).to.equal("Sam to move");
    await tap(black, at(8, 8));
    expect(black.find(".lf-renju-ghost").exists()).to.equal(false);
    await tap(black, at(8, 8));
    expect(moves).to.have.length(1);
    black.destroy();
  });

  it("falls back to local play when the shared board is unavailable", async () => {
    const backend: RenjuBackend = {
      gameId: "game-one",
      userId: "user-one",
      load: async () => {
        throw new Error("renju_board is missing");
      },
      subscribe: () => () => undefined,
      move: async (_previous, next) => next,
      reset: async () => undefined,
    };
    const wrapper = mountBoard(backend);
    await settle();
    await tap(wrapper, at(1, 1));
    await tap(wrapper, at(1, 1));
    expect(wrapper.findAll(".lf-renju-stone")).to.have.length(1);
    wrapper.destroy();
  });
});
