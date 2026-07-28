/* eslint-disable @typescript-eslint/camelcase */
import { expect } from "chai";
import { createLocalVue, mount } from "@vue/test-utils";
import Vuex from "vuex";
import { RenjuBackend, RenjuRow } from "../logic/renju-backend";
import { EMPTY_RENJU_BOARD } from "../logic/renju";
import ResearchPanel from "./ResearchPanel.vue";

const localVue = createLocalVue();
localVue.use(Vuex);

// A hosted game's backend. The renju POSITION is shared through it; which face a viewer is looking
// at deliberately is not, so this test double has no panel-mode write at all - the component may
// only ever reach localStorage for that.
function hostedBackend(userId = "user-one") {
  const row: RenjuRow = {
    board: EMPTY_RENJU_BOARD,
    last_move: null,
    black_user: null,
    black_user_2: null,
    white_user: null,
    white_user_2: null,
    black_next_user: null,
    white_next_user: null,
  };
  const listeners = new Set<(next: RenjuRow) => void>();
  const backend: RenjuBackend = {
    gameId: "game-one",
    userId,
    load: async () => row,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    move: async (_previous, next) => next,
    reset: async () => undefined,
  };
  return { backend, listeners };
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

// `time` stamps the event on the clock the drawer measures flick speed with. Left out, every event
// of a test gesture lands in the same instant, which is too short a span to time - so those gestures
// are decided on distance alone, exactly as before flicks existed.
function dispatchPointer(
  element: Element,
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1,
  time?: number
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    isPrimary: { value: true },
    pointerId: { value: pointerId },
  });
  if (time !== undefined) {
    Object.defineProperty(event, "timeStamp", { value: time });
  }
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

  it("keeps each viewer's face to themselves in a hosted game", async () => {
    // Owner request: the minigame must not be shared state - one player swiping to renju used to
    // drag every other viewer's research panel along with them.
    window.history.pushState({}, "", "/?game=hosted-one");
    const { backend } = hostedBackend();
    const mine = mountPanel(backend);
    const theirs = mountPanel(hostedBackend("user-two").backend);
    await settle();

    await mine.find('[data-mode="renju"]').trigger("click");
    await settle();
    expect((mine.vm as any).showRenju).to.equal(true);
    expect((theirs.vm as any).showRenju).to.equal(false);
    mine.destroy();
    theirs.destroy();
  });

  it("remembers the chosen face per hosted game and per account, across leaving and re-entering", async () => {
    window.history.pushState({}, "", "/?game=hosted-one");
    const wrapper = mountPanel(hostedBackend().backend);
    await settle();
    await wrapper.find('[data-mode="renju"]').trigger("click");
    await settle();
    wrapper.destroy(); // leave the game...

    const reopened = mountPanel(hostedBackend().backend); // ...and come back
    await settle();
    expect((reopened.vm as any).showRenju).to.equal(true);
    reopened.destroy();

    // A different account on the same browser, and the same account in a different game, both start
    // from their own default rather than inheriting this one.
    const otherAccount = mountPanel(hostedBackend("user-two").backend);
    await settle();
    expect((otherAccount.vm as any).showRenju).to.equal(false);
    otherAccount.destroy();

    window.history.pushState({}, "", "/?game=hosted-two");
    const otherGame = mountPanel(hostedBackend().backend);
    await settle();
    expect((otherGame.vm as any).showRenju).to.equal(false);
    otherGame.destroy();
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
    window.history.pushState({}, "", "/?game=hosted-one");
    const { backend } = hostedBackend();
    const wrapper = mountPanel(backend);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });

    // A mostly-vertical drag must not become a swipe (the page has to keep scrolling).
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 190, 260);
    dispatchPointer(panel, "pointerup", 190, 260);
    await settle();
    expect((wrapper.vm as any).showRenju).to.equal(false);

    // A short horizontal drag falls under the commit threshold (18px at this width) and springs back.
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 188, 202);
    dispatchPointer(panel, "pointerup", 188, 202);
    await settle();
    expect((wrapper.vm as any).showRenju).to.equal(false);

    // A full horizontal swipe commits the switch.
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 100, 205);
    dispatchPointer(panel, "pointerup", 100, 205);
    await settle();
    expect((wrapper.vm as any).showRenju).to.equal(true);
    wrapper.destroy();
  });

  it("switches on a small deliberate swipe, without a flick to help it", async () => {
    // Owner request: "a small swipe should make it change state ... currently you have to swipe too
    // far". 20px of unhurried travel on a 300px-wide panel is now enough - no timestamps here, so
    // this gesture measures as unmeasurably slow and the distance rule alone decides it.
    const wrapper = mountPanel(null);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });

    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 190, 201);
    dispatchPointer(panel, "pointermove", 180, 202);
    dispatchPointer(panel, "pointerup", 180, 202);
    await settle();

    expect((wrapper.vm as any).showRenju).to.equal(true);
    wrapper.destroy();
  });

  it("opens on a quick flick that never travels the commit distance", async () => {
    // Owner report: the drawer bounced back far too often. A thrown-open drawer is short and fast,
    // so speed commits on its own - here 12px of travel against an 18px distance threshold.
    const wrapper = mountPanel(null);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });

    dispatchPointer(panel, "pointerdown", 200, 200, 1, 0);
    dispatchPointer(panel, "pointermove", 192, 203, 1, 18);
    dispatchPointer(panel, "pointermove", 189, 204, 1, 28);
    dispatchPointer(panel, "pointerup", 188, 204, 1, 34);
    await settle();

    expect((wrapper.vm as any).showRenju).to.equal(true);
    wrapper.destroy();
  });

  it("keeps watching a drag that starts diagonally instead of writing it off", async () => {
    // The first sample past the dead zone used to decide the gesture for good, so a swipe that began
    // with a few pixels of vertical wobble did nothing at all.
    const wrapper = mountPanel(null);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });

    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 194, 210);
    expect((wrapper.vm as any).panelSwipeActive).to.equal(false);
    dispatchPointer(panel, "pointermove", 170, 214);
    expect((wrapper.vm as any).panelSwipeActive).to.equal(true);
    dispatchPointer(panel, "pointerup", 150, 216);
    await settle();

    expect((wrapper.vm as any).showRenju).to.equal(true);
    wrapper.destroy();
  });

  it("does not capture the pointer until a drag is recognised, so a plain press still reaches the face", async () => {
    // Capturing on pointerdown retargeted every later mouse event - pointerup and the click derived
    // from it - to the panel itself, which left the renju face (plain SVG rects with click handlers,
    // not buttons) unplayable with a mouse. A drag still needs capture, just not before there is one.
    const wrapper = mountPanel(null);
    await settle();
    const panel = wrapper.find(".research-panel").element;
    Object.defineProperty(panel, "clientWidth", { value: 300, configurable: true });
    const captured: number[] = [];
    (panel as any).setPointerCapture = (pointerId: number) => captured.push(pointerId);
    (panel as any).hasPointerCapture = (pointerId: number) => captured.indexOf(pointerId) !== -1;
    (panel as any).releasePointerCapture = () => undefined;

    dispatchPointer(panel, "pointerdown", 200, 200);
    expect(captured).to.deep.equal([]);
    dispatchPointer(panel, "pointerup", 200, 200);
    await settle();
    expect(captured).to.deep.equal([]);

    // A real horizontal drag does take the pointer, so the rest of the gesture keeps arriving.
    dispatchPointer(panel, "pointerdown", 200, 200);
    dispatchPointer(panel, "pointermove", 100, 205);
    expect(captured).to.deep.equal([1]);
    dispatchPointer(panel, "pointerup", 100, 205);
    await settle();
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
