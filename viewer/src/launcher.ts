import BootstrapVue from "bootstrap-vue";
import { EventEmitter } from "events";
import Vue from "vue";
import type { VueConstructor } from "vue/types/umd";
import Condition from "./components/Condition.vue";
import Game from "./components/Game.vue";
import Resource from "./components/Resource.vue";
import TechContent from "./components/TechContent.vue";
import { makeStore } from "./store";

Vue.use(BootstrapVue);
Vue.component("Condition", Condition);
Vue.component("TechContent", TechContent);
Vue.component("Resource", Resource);

// iOS Safari (and older mobile Chrome) only emits `mouseenter`/`:hover` on the first tap of a
// session if some element on the page already has a click listener bound - otherwise the first
// tap on any `.hover`-triggered tooltip (v-b-tooltip) is swallowed and only the *second* tap
// (after tapping something else first) shows it. Binding a no-op touchstart listener up front
// arms hover emulation immediately, so the very first tap on any tooltip target works.
if (typeof document !== "undefined") {
  document.body.addEventListener("touchstart", () => undefined, true);
}

function launch(selector: string, component: VueConstructor<Vue> = Game) {
  let lastMovedAt: number = 0;

  const store = makeStore();

  const app = new Vue({
    store,
    render: (h) => h("div", { class: "container-fluid py-2" }, [h(component)]),
  }).$mount(selector);

  // Tooltips also carry `.click` (see the touchstart-arm comment above this function) so a first
  // tap always shows one, but that means a click-opened tooltip no longer auto-hides on its own
  // the way a hover-only one did when the pointer moved elsewhere - tapping a different component
  // left the previous one stuck open. A capture-phase listener fires before the newly-tapped
  // element's own tooltip-show handler (which only runs on bubble), so this closes whatever
  // tooltip is currently open before the tap's own handler runs.
  //
  // Critically, this must NOT fire when the click target is the element whose tooltip is already
  // open (or a descendant of it) - bootstrap-vue's own click handler *toggles* a click-armed
  // trigger (activeTrigger.click = !activeTrigger.click), so force-hiding it a moment before that
  // toggle runs left the toggle re-opening (or, on rapid re-taps, immediately re-closing) a
  // tooltip that had just been forcibly hidden out from under it - the tooltip would flash and
  // vanish within the same tap instead of behaving like a normal open/close toggle. Bootstrap-vue
  // marks a trigger element with `aria-describedby` for exactly as long as its tooltip is shown
  // (see addAriaDescribedby()/removeAriaDescribedby() in its source), so checking for that
  // attribute on the click target (or an ancestor, since the target is often an inner SVG shape
  // one level below the actual v-b-tooltip-bound element) reliably distinguishes "close some
  // other tooltip" from "let this element's own toggle handle itself."
  if (typeof document !== "undefined") {
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element | null;
        if (target?.closest?.("[aria-describedby]")) {
          return;
        }
        app.$emit("bv::hide::tooltip");
      },
      true
    );
  }

  const item: EventEmitter & { store: typeof store; app: Vue } = Object.assign(new EventEmitter(), { store, app });

  let replaying = false;

  item.addListener("state", (data) => {
    store.dispatch("externalData", data);
    item.emit("replaceLog", data?.moveHistory);
    app.$nextTick().then(() => item.emit("ready"));
  });
  item.addListener("state:updated", () => {
    if (!replaying) {
      item.emit("fetchState");
    }
  });
  item.addListener("preferences", (data) => store.commit("preferences", data));
  item.addListener("player", (data) => store.commit("player", data));
  // Premove (PREMOVE_PLAN.md) - hosted-mode-only; self-contained mode never emits this.
  item.addListener("premoveState", (data) => store.commit("premoveState", data));
  // Phase 3 (§10.6) - hosted-mode-only quiet success notice.
  item.addListener("premovePlayed", (data) => store.commit("premovePlayed", data));
  item.addListener("replay:start", () => {
    store.dispatch("replayStart");
    replaying = true;
  });
  item.addListener("replay:to", (info) => {
    store.dispatch("replayTo", info);
    item.emit("replaceLog", store.state.data.moveHistory);
  });
  item.addListener("avatars", (data) => store.commit("avatars", data));
  item.addListener("replay:end", () => {
    store.dispatch("replayEnd");
    replaying = false;
    item.emit("fetchState");
  });
  item.addListener("gamelog", (logData) => {
    if (replaying) {
      //
    } else {
      store.dispatch("externalData", logData.data.state);
      item.emit("replaceLog", logData.data.state?.moveHistory);
    }
  });

  const unsub1 = store.subscribeAction(({ type, payload }) => {
    // console.log("spy action", type, payload);

    if (type === "move") {
      // There's a bug with the viewer, after an undo on some occasions moves are emitted twice in a row
      if (lastMovedAt + 50 > Date.now()) {
        return;
      }
      lastMovedAt = Date.now();

      item.emit("move", payload);
      return;
    }

    if (
      type === "queuePremove" ||
      type === "cancelPremove" ||
      type === "cancelAllPremoves" ||
      type === "reorderPremove" ||
      type === "markPremoveFailureRead"
    ) {
      item.emit(type, payload);
      return;
    }

    if (type === "playerClick") {
      item.emit("player:clicked", {
        name: payload.name,
        auth: payload.auth,
        index: store.state.data?.players?.findIndex((pl) => pl === payload),
      });
    }

    if (type === "replayInfo") {
      item.emit("replay:info", payload);
    }
  });

  const unsub2 = store.subscribe(({ type, payload }) => {
    // console.log("spy mutation", type, payload);

    if (type === "info" || type === "error") {
      item.emit(type, payload);
    }
  });

  app.$once("hook:beforeDestroy", () => {
    unsub1();
    unsub2();
  });

  return item;
}

export default launch;
