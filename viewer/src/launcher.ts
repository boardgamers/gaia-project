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
  // The lib may be loaded from <head> (e.g. the platform's iframe wrapper), where document.body
  // does not exist yet at module evaluation time.
  const armHoverEmulation = () => document.body.addEventListener("touchstart", () => undefined, true);
  if (document.body) {
    armHoverEmulation();
  } else {
    document.addEventListener("DOMContentLoaded", armHoverEmulation);
  }
}

// The boardgamers.space host page signals dark mode by toggling the "dark" class on <html>
// (live, via postMessage - see the platform's iframe wrapper). The component styles inherited
// from the fork's theming system read their colors from CSS custom properties scoped under
// :root[data-theme="dark"], so mirror the host's class onto that attribute (and keep it in
// sync when the user flips the theme mid-game).
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const syncTheme = () => {
    document.documentElement.dataset.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  };
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// NOTE: there used to be a capture-phase `touchend` handler here that called
// `event.preventDefault()` on any second tap of the same target within 350ms, meant to block
// double-tap-to-zoom. It was removed because calling preventDefault() on `touchend` also cancels
// the synthetic `click` the browser would otherwise fire, so a quick same-target re-tap silently
// swallowed the click - intermittently breaking the lobby's game-entry `<a href="?game=">` links
// and the in-game back `<a href="?lobby=1">` link ("most times work, sometimes don't"). Double-tap
// zoom is already disabled globally by `body { touch-action: manipulation }` (frontend.scss),
// which does NOT suppress clicks, so the JS handler was redundant as well as harmful.

function launch(selector: string, component: VueConstructor<Vue> = Game) {
  let lastMovedAt = 0;

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
  // Premove cancel triggers - hosted-mode-only, same shape as the two listeners above.
  item.addListener("cancelTriggerState", (data) => store.commit("cancelTriggerState", data));
  item.addListener("cancelTriggerFired", (data) => store.commit("cancelTriggerFired", data));
  item.addListener("replay:start", () => {
    store.dispatch("replayStart");
    replaying = true;
  });
  item.addListener("replay:to", (info) => {
    store.dispatch("replayTo", info);
    item.emit("replaceLog", store.state.data.moveHistory);
  });
  item.addListener("avatars", (data) => store.commit("avatars", data));
  // Presence (PROGRESS.md Gaia 9) - hosted-mode-only; self-contained mode never emits either.
  item.addListener("seatUsers", (data) => store.commit("seatUsers", data));
  item.addListener("seatLastActive", (data) => store.commit("seatLastActive", data));
  item.addListener("presence", (data) => store.commit("presence", data));
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
      type === "editPremove" ||
      type === "cancelAllPremoves" ||
      type === "reorderPremove" ||
      type === "markPremoveFailureRead" ||
      type === "armCancelTrigger" ||
      type === "disarmCancelTrigger" ||
      type === "disarmAllCancelTriggers" ||
      type === "editCancelTrigger"
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
