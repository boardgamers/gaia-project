/* eslint-disable @typescript-eslint/camelcase */
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { RenjuBackend, RenjuPanelMode, RenjuRow } from "../logic/renju-backend";
import { EMPTY_RENJU_BOARD } from "../logic/renju";
import ResearchPanel from "./ResearchPanel.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

function sharedBackend(initialMode: RenjuPanelMode) {
  let row: RenjuRow = {
    board: EMPTY_RENJU_BOARD,
    last_move: null,
    black_user: null,
    black_user_2: null,
    white_user: null,
    white_user_2: null,
    black_next_user: null,
    white_next_user: null,
    panel_mode: initialMode,
  };
  const listeners = new Set<(next: RenjuRow) => void>();
  const writes: RenjuPanelMode[] = [];
  const backend: RenjuBackend = {
    gameId: "game-one",
    userId: "user-one",
    load: async () => row,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    move: async (_previous, next) => next,
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

function mountPanel(backend: RenjuBackend | null) {
  const store = new Vuex.Store({ state: { renjuBackend: backend, seatUsers: {}, data: { players: [] } } });
  return mount(ResearchPanel as any, {
    localVue,
    store,
    slots: { default: '<svg class="scoring-research-board" />' },
    stubs: { RenjuBoard: { template: '<div class="renju-board-stub" />' } },
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

describe("ResearchPanel drawer", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("keeps the research board mounted and only mounts renju on demand", async () => {
    const wrapper = mountPanel(null);
    await settle();
    const researchFace = wrapper.find(".scoring-research-board").element;
    expect(wrapper.findAll(".research-mode-dot")).to.have.length(2);
    expect(wrapper.find('[data-mode="research"]').attributes("aria-pressed")).to.equal("true");
    expect(wrapper.find(".renju-face").exists()).to.equal(false);

    await wrapper.find('[data-mode="renju"]').trigger("click");
    await settle();
    expect(wrapper.find(".renju-face").exists()).to.equal(true);
    // The research art is never torn down or re-created by a face switch.
    expect(wrapper.find(".scoring-research-board").element).to.equal(researchFace);
    expect(wrapper.find(".research-board-face").attributes("aria-hidden")).to.equal("true");
    wrapper.destroy();
  });

  it("mirrors every shared mode change to all viewers of the game", async () => {
    const { backend, listeners, writes } = sharedBackend("research");
    const first = mountPanel(backend);
    const second = mountPanel(backend);
    await settle();
    expect(listeners.size).to.equal(2);

    await first.find('[data-mode="renju"]').trigger("click");
    await settle();
    expect(writes).to.deep.equal(["renju"]);
    expect((first.vm as any).showRenju).to.equal(true);
    expect((second.vm as any).showRenju).to.equal(true);

    await second.find('[data-mode="research"]').trigger("click");
    await settle();
    expect(writes).to.deep.equal(["renju", "research"]);
    expect((first.vm as any).showRenju).to.equal(false);
    first.destroy();
    second.destroy();
  });

  it("remembers the chosen face per offline game when there is no backend", async () => {
    window.history.pushState({}, "", "/?offline=1&game=panel-one");
    const wrapper = mountPanel(null);
    await settle();
    await wrapper.find('[data-mode="renju"]').trigger("click");
    await settle();
    wrapper.destroy();

    const reopened = mountPanel(null);
    await settle();
    expect((reopened.vm as any).showRenju).to.equal(true);
    reopened.destroy();
  });

  it("switches faces on a horizontal swipe but leaves a vertical drag to the page", async () => {
    const { backend, writes } = sharedBackend("research");
    const wrapper = mountPanel(backend);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });

    // A mostly-vertical drag must not become a swipe (the page has to keep scrolling).
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 190, 260);
    dispatchPointer(panel, "pointerup", 190, 260);
    await settle();
    expect(writes).to.deep.equal([]);
    expect((wrapper.vm as any).showRenju).to.equal(false);

    // A short horizontal drag falls under the commit threshold and springs back.
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 180, 202);
    dispatchPointer(panel, "pointerup", 180, 202);
    await settle();
    expect(writes).to.deep.equal([]);

    // A full horizontal swipe commits the switch.
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 100, 205);
    dispatchPointer(panel, "pointerup", 100, 205);
    await settle();
    expect(writes).to.deep.equal(["renju"]);
    expect((wrapper.vm as any).showRenju).to.equal(true);
    wrapper.destroy();
  });

  it("swallows the click a touch release synthesizes, so a swipe cannot press a move button", async () => {
    const wrapper = mountPanel(null);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });

    let clicked = 0;
    const board = wrapper.find(".scoring-research-board").element;
    board.addEventListener("click", () => clicked++);

    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 100, 205);
    dispatchPointer(panel, "pointerup", 100, 205);
    board.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    expect(clicked).to.equal(0);

    // Only that one click is consumed; the panel stays usable straight afterwards.
    await settle();
    board.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    expect(clicked).to.equal(1);
    wrapper.destroy();
  });
});
