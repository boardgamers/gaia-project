import Engine from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import PremoveBar from "./PremoveBar.vue";

Vue.use(BootstrapVue);

const SETUP_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
];

describe("PremoveBar", () => {
  it("clears zoom compensation after a pinch leaves only a tiny scale residue", () => {
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const listeners: Record<string, Array<() => void>> = {};
    const viewport = {
      scale: 2,
      offsetLeft: 10,
      offsetTop: 40,
      height: 420,
      addEventListener(type: string, listener: () => void) {
        (listeners[type] ?? (listeners[type] = [])).push(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners[type] = (listeners[type] ?? []).filter((candidate) => candidate !== listener);
      },
    };

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });

    const wrapper = mount(PremoveBar, {
      propsData: {
        seat: 0,
        composeModePreference: "sequential",
        stickyMobile: true,
      },
      store: makeStore(),
    });

    try {
      const bar = wrapper.element as HTMLElement;
      expect(bar.style.transform, "a genuine zoom should be compensated").to.not.equal("");

      // Recreate the state that caused the intermittent bug: the pinch has ended, but the browser
      // reports a scale infinitesimally different from 1 while an ordinary scroll changes the
      // visual viewport's top/height. The bar must remove its transform and return to native fixed
      // positioning instead of translating up into the middle of the screen.
      viewport.scale = 1.0000000002;
      viewport.offsetLeft = 0;
      viewport.offsetTop = 90;
      viewport.height = 600;
      for (const listener of listeners.scroll ?? []) {
        listener();
      }

      expect(bar.style.transform).to.equal("");
    } finally {
      wrapper.destroy();
      if (originalVisualViewport) {
        Object.defineProperty(window, "visualViewport", originalVisualViewport);
      } else {
        delete (window as any).visualViewport;
      }
    }
  });

  // The bottom-sheet chrome (dark header band + grab handle) belongs to the off-turn sticky layout
  // only - the in-flow desktop card keeps the plain `__will-fire` line instead. Both live in the
  // same stylesheet and are toggled by the media query, so what's asserted here is the DOM half of
  // that split: the header exists to be styled at all only while the bar is in sticky mode.
  it("renders the bottom-sheet header only in sticky-mobile mode", () => {
    const sticky = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: true },
      store: makeStore(),
    });
    const inFlow = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: false },
      store: makeStore(),
    });

    try {
      expect(sticky.find(".premove-bar__sheet-title").exists()).to.be.true;
      expect(sticky.find(".premove-bar__sheet-title").text()).to.equal("Plan your next turn");
      expect(inFlow.find(".premove-bar__sheet-title").exists()).to.be.false;
    } finally {
      sticky.destroy();
      inFlow.destroy();
    }
  });

  // Mode used to be two "+" buttons that each ALSO rewrote a queue-wide setting (and one of which
  // silently discarded the queue). It's a labelled two-way choice now, with a single add action
  // beside it, so "which mode am I in" and "add a move" stop being the same click.
  it("separates the mode choice from the single add action", () => {
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: false },
      store: makeStore(),
    });
    try {
      const modes = wrapper.findAll(".premove-bar__segment-option").wrappers.map((w) => w.text().trim());
      expect(modes).to.deep.equal(["Chain", "Fallback"]);
      expect(wrapper.find(".premove-bar__segment-option--on").text().trim()).to.equal("Chain");

      const actions = wrapper.findAll(".premove-bar__action-button").wrappers.map((w) => w.text().trim());
      expect(actions).to.deep.equal(["+ Add move", "⚠ Cancel if…"]);
    } finally {
      wrapper.destroy();
    }
  });

  it("emits start-cancel-trigger from the ⚠ Cancel if… button", async () => {
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: false },
      store: makeStore(),
    });
    try {
      const buttons = wrapper.findAll(".premove-bar__action-button");
      await buttons.at(1).trigger("click");
      expect(wrapper.emitted("start-cancel-trigger")).to.have.length(1);
    } finally {
      wrapper.destroy();
    }
  });

  // The cancel-rule steps used to be a b-modal in Game.vue, which threw the player from the bottom
  // of the screen to the middle of it in the middle of one task. They render in the sheet now.
  it("renders the cancel-rule steps inside the sheet, with the band and footer following the step", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(SETUP_MOVES));
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: true, stage: "picker" },
      store,
    });
    try {
      expect(wrapper.find(".cancel-trigger-picker").exists()).to.be.true;
      expect(wrapper.find(".premove-bar__sheet-title").text()).to.equal("Cancel my queue if…");
      // The picker's own chips are the action, so the footer offers only the escape.
      const footer = wrapper.findAll(".premove-bar__foot .premove-bar__action-button");
      expect(footer.wrappers.map((w) => w.text().trim())).to.deep.equal(["Back"]);
    } finally {
      wrapper.destroy();
    }
  });

  it("keeps Arm rule disabled until the refine step reports a selection", async () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(SETUP_MOVES));
    const wrapper = mount(PremoveBar, {
      propsData: {
        seat: 0,
        composeModePreference: "sequential",
        stickyMobile: true,
        stage: "refine",
        watchedSeat: 1,
        draftMove: "nevlas build lab 7A6. tech eco. up eco",
      },
      store,
    });
    try {
      const arm = () => wrapper.findAll(".premove-bar__foot .premove-bar__action-button").at(0);
      expect(wrapper.find(".premove-bar__sheet-title").text()).to.equal("Cancel if Nevlas…");
      expect(arm().attributes("disabled")).to.equal("disabled");

      (wrapper.findComponent({ name: "CancelTriggerRefine" }).vm as any).selected = [true, false, false];
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();
      expect(arm().attributes("disabled")).to.equal(undefined);

      await arm().trigger("click");
      expect(wrapper.emitted("arm-refine")).to.deep.equal([[["build:lab:7A6"]]]);
    } finally {
      wrapper.destroy();
    }
  });

  // Every entry readable at once, carrying its own move text - it used to be a tab strip labelled
  // "Premove 1/2/3" that revealed one entry at a time.
  it("lists every queued entry with its move text and its own legality state", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(SETUP_MOVES));
    store.commit("premoveState", {
      premoves: [
        { seat: 0, seq: 1, move: "terrans build m -2x2", mode: "sequential", queued_move_count: 5 },
        { seat: 0, seq: 2, move: "terrans burn 1", mode: "sequential", queued_move_count: 5 },
      ],
      failures: [],
    });
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: false },
      store,
    });
    try {
      const moves = wrapper.findAll(".premove-bar__entry-move").wrappers.map((w) => w.text().trim());
      expect(moves).to.deep.equal(["terrans build m -2x2", "terrans burn 1"]);
      // Each row states its own status rather than hiding it behind a tap.
      expect(wrapper.findAll(".premove-bar__entry-state")).to.have.length(2);
    } finally {
      wrapper.destroy();
    }
  });

  // The cascade / failure / played-automatically notices used to render in Game.vue's in-flow
  // column, i.e. up the page, above a sheet pinned to the bottom of the viewport.
  it("shows the 'played automatically' notice inside the sheet", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(SETUP_MOVES));
    store.commit("premovePlayed", { seat: 0, move: "terrans build m -2x2" });
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: true },
      store,
    });
    try {
      expect(wrapper.find(".premove-bar__notice--ok").text()).to.contain("terrans build m -2x2");
    } finally {
      wrapper.destroy();
    }
  });

  it("lists armed triggers (move and leech kind) with Edit/Remove, and removing dispatches disarmCancelTrigger", async () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(SETUP_MOVES));
    store.commit("cancelTriggerState", [
      {
        seat: 0,
        seq: 1,
        kind: "move",
        watched_seat: 1,
        move: "",
        atoms: ["up:eco"],
        config: {},
        match: "any",
        armed_from_move_count: 0,
      },
      {
        seat: 0,
        seq: 2,
        kind: "leech",
        watched_seat: 0,
        move: "",
        atoms: [],
        config: { mode: "gained", minPower: 2 },
        match: "any",
        armed_from_move_count: 0,
      },
    ]);
    const dispatched: any[] = [];
    store.dispatch = (type: string, payload: any) => {
      dispatched.push({ type, payload });
      return Promise.resolve();
    };
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: false },
      store,
    });
    try {
      const rows = wrapper.findAll(".premove-bar__trigger-row");
      expect(rows).to.have.length(2);
      expect(rows.at(0).text()).to.contain("Nevlas");
      expect(rows.at(0).text()).to.contain("advances Economy");
      expect(rows.at(1).text()).to.contain("Power charge ≥ 2 taken by me");

      await rows.at(1).find("button.btn-link:last-child").trigger("click");
      expect(dispatched).to.deep.equal([{ type: "disarmCancelTrigger", payload: { seat: 0, seq: 2 } }]);
    } finally {
      wrapper.destroy();
    }
  });

  it("the fired-state header reads 'Cancelled - <reason>' once a cancel trigger has matched", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(SETUP_MOVES));
    store.commit("premoveState", {
      premoves: [],
      failures: [{ id: "1", seat: 0, move: "", reason: "Nevlas advanced Economy", read_at: null, kind: "cancelled" }],
    });
    const wrapper = mount(PremoveBar, {
      propsData: { seat: 0, composeModePreference: "sequential", stickyMobile: true },
      store,
    });
    try {
      expect(wrapper.find(".premove-bar__sheet-title").text()).to.equal("Cancelled — Nevlas advanced Economy");
    } finally {
      wrapper.destroy();
    }
  });
});
