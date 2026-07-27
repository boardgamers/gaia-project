/* eslint-disable @typescript-eslint/camelcase */
// Fake hosted rows mirror Supabase column names.
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { ChessBackend, ChessRow } from "../logic/chess-backend";
import { createChess } from "../logic/chess-lib";
import { localChessLastMoveStorageKey, localChessStorageKey, START_FEN } from "../logic/chess";
import ChessBoard from "./ChessBoard.vue";
import { PANEL_SWIPE_EVENT } from "../logic/panel-swipe";

const localVue = createLocalVue();
localVue.use(Vuex);

function storeWith(
  chessBackend: ChessBackend | null,
  playerCount = 2,
  playerNames: string[] = [],
  seatUsers: Record<number, string | null> = {}
) {
  return new Vuex.Store({
    state: {
      chessBackend,
      seatUsers,
      data: {
        players: Array.from({ length: playerCount }, (_, seat) => ({ name: playerNames[seat] ?? "" })),
      },
    },
  });
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fenAfterE4(): string {
  const chess = createChess(START_FEN);
  chess.move({ from: "e2", to: "e4" });
  return chess.fen();
}

function fenAfterWhiteCapturesPawn(): string {
  const chess = createChess(START_FEN);
  chess.move({ from: "e2", to: "e4" });
  chess.move({ from: "d7", to: "d5" });
  chess.move({ from: "e4", to: "d5" });
  return chess.fen();
}

describe("ChessBoard", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("shows only the board and a text-free White-relative evaluation edge", async () => {
    const wrapper = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();

    const meter = wrapper.find(".lf-chess-eval");
    expect(meter.exists()).to.equal(true);
    expect(meter.attributes("role")).to.equal("meter");
    expect(meter.attributes("aria-valuenow")).to.equal("50");
    expect(meter.text()).to.equal("");
    expect(meter.element.nextElementSibling).to.equal(wrapper.find(".lf-chess-board").element);
    expect(wrapper.find(".lf-chess-stage").attributes("data-centering")).to.equal("full-stack");
    expect(wrapper.findAll(".lf-chess-captures")).to.have.length(2);
    expect(wrapper.find(".lf-chess-header").exists()).to.equal(false);
    expect(wrapper.find(".lf-chess-controls").exists()).to.equal(false);
    expect(wrapper.find(".lf-chess-turn").text()).to.equal("White to move");
    wrapper.destroy();
  });

  it("centres the board between persistent top and bottom captured-piece rows", async () => {
    window.history.pushState({}, "", "/?offline=1&game=offline-capture");
    window.localStorage.setItem(localChessStorageKey(window.location.search), fenAfterWhiteCapturesPawn());
    const wrapper = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();

    // It is Black's turn, so Black is at the bottom in offline pass-and-play. White is at the top,
    // and the black pawn White captured is therefore shown in the reserved top row.
    expect(wrapper.findAll(".lf-chess-captures.top .lf-chess-captured-piece")).to.have.length(1);
    expect(wrapper.find(".lf-chess-captures.top .lf-chess-captured-piece").classes()).to.include("black");
    expect(wrapper.findAll(".lf-chess-captures.bottom .lf-chess-captured-piece")).to.have.length(0);
    wrapper.destroy();
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
    expect(window.localStorage.getItem(localChessLastMoveStorageKey(window.location.search))).to.equal(
      '{"from":"e2","to":"e4"}'
    );
    expect(wrapper.find('[data-square="e2"]').classes()).to.include("last-from");
    expect(wrapper.find('[data-square="e4"]').classes()).to.include("last-to");
    expect(wrapper.find(".lf-chess-last-arrow").exists()).to.equal(true);
    expect(wrapper.findAll(".lf-chess-square").at(0).attributes("data-square")).to.equal("h1");
    expect(wrapper.find(".lf-chess-turn").text()).to.equal("Black to move");
    expect(wrapper.emitted("close")).to.equal(undefined);
    wrapper.destroy();
  });

  it("restores only the current offline Gaia game's chess position", async () => {
    window.history.pushState({}, "", "/?offline=1&game=offline-one");
    window.localStorage.setItem(localChessStorageKey(window.location.search), fenAfterE4());
    window.localStorage.setItem(localChessLastMoveStorageKey(window.location.search), '{"from":"e2","to":"e4"}');
    const first = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();
    expect((first.vm as any).fen).to.equal(fenAfterE4());
    expect(first.find('[data-square="e2"]').classes()).to.include("last-from");
    expect(first.find('[data-square="e4"]').classes()).to.include("last-to");
    first.destroy();

    window.history.pushState({}, "", "/?offline=1&game=offline-two");
    const second = mount(ChessBoard as any, { localVue, store: storeWith(null) });
    await flush();
    expect((second.vm as any).fen).to.equal(START_FEN);
    second.destroy();
  });

  it("keeps an online player's own colour at the bottom and persists through the injected game backend", async () => {
    const moves: Array<[string, string]> = [];
    const row: ChessRow = {
      fen: START_FEN,
      last_move_from: "e7",
      last_move_to: "e5",
      white_user: "user-white",
      white_user_2: null,
      black_user: "user-black",
      black_user_2: null,
      white_next_user: "user-white",
      black_next_user: "user-black",
    };
    const backend: ChessBackend = {
      gameId: "game-one",
      userId: "user-white",
      load: async () => row,
      subscribe: () => () => undefined,
      move: async (before, after, from, to) => {
        moves.push([before, after, from, to] as any);
        return after;
      },
      reset: async () => undefined,
    };
    const wrapper = mount(ChessBoard as any, {
      localVue,
      store: storeWith(backend, 2, ["Alice", "Bob"], { 0: "user-white", 1: "user-black" }),
    });
    await flush();

    expect(wrapper.find(".lf-chess-turn").text()).to.equal("Alice to move");
    expect(wrapper.find('[data-square="e7"]').classes()).to.include("last-from");
    expect(wrapper.find('[data-square="e5"]').classes()).to.include("last-to");
    await wrapper.find('[data-square="e2"]').trigger("click");
    await wrapper.find('[data-square="e4"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(moves).to.have.length(1);
    expect(moves[0][0]).to.equal(START_FEN);
    expect(moves[0][1].split(" ")[1]).to.equal("b");
    expect((moves[0] as any).slice(2)).to.deep.equal(["e2", "e4"]);
    expect(wrapper.findAll(".lf-chess-square").at(0).attributes("data-square")).to.equal("a8");
    expect(wrapper.find(".lf-chess-turn").text()).to.equal("Bob to move");
    wrapper.destroy();
  });

  it("keeps both teammates oriented to their colour but only lets the designated relay member move", async () => {
    const moves: Array<[string, string]> = [];
    let listener: ((row: ChessRow) => void) | null = null;
    let row: ChessRow = {
      fen: START_FEN,
      white_user: "user-white-one",
      white_user_2: "user-white-two",
      black_user: "user-black-one",
      black_user_2: "user-black-two",
      white_next_user: "user-white-one",
      black_next_user: "user-black-one",
    };
    const backend: ChessBackend = {
      gameId: "game-four",
      userId: "user-white-two",
      load: async () => row,
      subscribe: (next) => {
        listener = next;
        return () => undefined;
      },
      move: async (before, after) => {
        moves.push([before, after]);
        return after;
      },
      reset: async () => undefined,
    };
    const wrapper = mount(ChessBoard as any, {
      localVue,
      store: storeWith(backend, 4, ["White One", "White Two", "Black One", "Black Two"], {
        0: "user-white-one",
        1: "user-white-two",
        2: "user-black-one",
        3: "user-black-two",
      }),
    });
    await flush();

    expect(wrapper.find(".lf-chess-turn").text()).to.equal("White One to move");
    expect(wrapper.findAll(".lf-chess-square").at(0).attributes("data-square")).to.equal("a8");
    await wrapper.find('[data-square="e2"]').trigger("click");
    await wrapper.find('[data-square="e4"]').trigger("click");
    expect(moves).to.have.length(0);

    row = { ...row, white_next_user: "user-white-two" };
    listener?.(row);
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".lf-chess-turn").text()).to.equal("White Two to move");
    await wrapper.find('[data-square="e2"]').trigger("click");
    await wrapper.find('[data-square="e4"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(moves).to.have.length(1);
    wrapper.destroy();
  });

  it("never exposes manual chess-seat controls after automatic assignment", async () => {
    const baseRow: ChessRow = {
      fen: START_FEN,
      white_user: "white-one",
      white_user_2: null,
      black_user: "black-one",
      black_user_2: null,
      white_next_user: "white-one",
      black_next_user: "black-one",
    };
    const backend = (load: () => Promise<ChessRow>): ChessBackend => ({
      gameId: "game-team",
      userId: "spectator",
      load,
      subscribe: () => () => undefined,
      move: async (_before, after) => after,
      reset: async () => undefined,
    });

    const fourPlayer = mount(ChessBoard as any, {
      localVue,
      store: storeWith(
        backend(async () => baseRow),
        4
      ),
    });
    await flush();
    expect(fourPlayer.find(".lf-chess-controls").exists()).to.equal(false);
    expect(fourPlayer.findAll(".lf-chess-btn")).to.have.length(0);
    fourPlayer.destroy();

    const fullThreePlayer = mount(ChessBoard as any, {
      localVue,
      store: storeWith(
        backend(async () => ({ ...baseRow, white_user_2: "white-two" })),
        3
      ),
    });
    await flush();
    expect(fullThreePlayer.find(".lf-chess-controls").exists()).to.equal(false);
    fullThreePlayer.destroy();
  });

  it("lets a one-account hosted test game play both colours and rotates after each move", async () => {
    let row: ChessRow = {
      fen: START_FEN,
      white_user: "solo",
      white_user_2: null,
      black_user: "solo",
      black_user_2: null,
      white_next_user: "solo",
      black_next_user: "solo",
    };
    const moves: string[] = [];
    const backend: ChessBackend = {
      gameId: "solo-game",
      userId: "solo",
      load: async () => row,
      subscribe: () => () => undefined,
      move: async (_before, after) => {
        moves.push(after);
        row = { ...row, fen: after };
        return after;
      },
      reset: async () => undefined,
    };
    const wrapper = mount(ChessBoard as any, { localVue, store: storeWith(backend, 4) });
    await flush();

    await wrapper.find('[data-square="e2"]').trigger("click");
    await wrapper.find('[data-square="e4"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(moves).to.have.length(1);
    expect(wrapper.findAll(".lf-chess-square").at(0).attributes("data-square")).to.equal("h1");

    await wrapper.find('[data-square="e7"]').trigger("click");
    await wrapper.find('[data-square="e5"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(moves).to.have.length(2);
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

    wrapper.vm.$root.$emit(PANEL_SWIPE_EVENT);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".lf-chess-confirm-text").exists()).to.equal(false);
    expect((wrapper.vm as any).fen).to.equal(fenAfterE4());

    (wrapper.vm as any).showResetConfirm = true;
    await wrapper.vm.$nextTick();
    await wrapper.find(".lf-chess-confirm-actions .danger").trigger("click");
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).fen).to.equal(START_FEN);
    expect(window.localStorage.getItem(localChessStorageKey(window.location.search))).to.equal(START_FEN);
    expect(window.localStorage.getItem(localChessLastMoveStorageKey(window.location.search))).to.equal(null);
    expect(wrapper.find(".lf-chess-last-arrow").exists()).to.equal(false);
    wrapper.destroy();
  });
});
