import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { localUltimateStorageKey } from "../logic/ultimate-tic-tac-toe";
import UltimateTicTacToeBoard from "./UltimateTicTacToeBoard.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function mountBoard() {
  const store = new Vuex.Store({
    state: {
      ultimateTicTacToeBackend: null,
      seatUsers: {},
      data: { players: [] },
    },
  });
  return mount(UltimateTicTacToeBoard as any, { localVue, store });
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("UltimateTicTacToeBoard", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("renders 81 cells, routes the reply, highlights the last move, and persists offline", async () => {
    window.history.pushState({}, "", "/?offline=1&game=ultimate-one");
    const wrapper = mountBoard();
    await settle();

    expect(wrapper.findAll(".lf-ultimate-cell")).to.have.length(81);
    expect(wrapper.findAll(".lf-ultimate-mini.valid")).to.have.length(9);
    expect(wrapper.find(".lf-ultimate-status").text()).to.equal("X to move · free move");

    await wrapper.findAll(".lf-ultimate-cell").at(8).trigger("click");
    expect(wrapper.findAll(".lf-ultimate-cell.last")).to.have.length(1);
    expect(wrapper.findAll(".lf-ultimate-mini.valid")).to.have.length(1);
    expect(wrapper.findAll(".lf-ultimate-mini").at(8).classes()).to.include("valid");
    expect(wrapper.find(".lf-ultimate-status").text()).to.equal("O to move · board 9");

    const stored = JSON.parse(
      window.localStorage.getItem(localUltimateStorageKey("?offline=1&game=ultimate-one")) ?? "null"
    );
    expect(stored.lastMove).to.equal(8);
    expect(stored.board.charAt(8)).to.equal("x");
    wrapper.destroy();
  });

  it("shows owned-board overlays, the winner, and a pinned X/O advantage meter", async () => {
    const wrapper = mountBoard();
    let board = ".".repeat(81);
    for (const index of [0, 1, 2, 9, 10, 11, 18, 19, 20]) {
      board = board.slice(0, index) + "x" + board.slice(index + 1);
    }
    for (const index of [27, 28, 30, 31, 33, 34, 36, 37]) {
      board = board.slice(0, index) + "o" + board.slice(index + 1);
    }
    await wrapper.setData({ board, lastMove: 20 });
    await settle();

    expect(wrapper.findAll(".lf-ultimate-mini-result.x")).to.have.length(3);
    expect(wrapper.find(".lf-ultimate-status").text()).to.equal("X wins");
    expect(wrapper.find(".lf-ultimate-eval").attributes("aria-valuenow")).to.equal("100");
    expect(wrapper.findAll(".lf-ultimate-cell.playable")).to.have.length(0);
    wrapper.destroy();
  });

  it("opens the reset confirmation on long press and clears only after confirmation", async () => {
    const wrapper = mountBoard();
    await wrapper.findAll(".lf-ultimate-cell").at(4).trigger("click");

    (wrapper.vm as any).onPointerDown({ button: 0, clientX: 10, clientY: 10 });
    await new Promise((resolve) => setTimeout(resolve, 620));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".lf-ultimate-confirm-text").text()).to.equal("Reset Ultimate tic-tac-toe?");

    await wrapper.find(".lf-ultimate-confirm-actions .danger").trigger("click");
    expect(wrapper.findAll(".lf-ultimate-cell.x")).to.have.length(0);
    expect(wrapper.find(".lf-ultimate-status").text()).to.equal("X to move · free move");
    wrapper.destroy();
  });
});
