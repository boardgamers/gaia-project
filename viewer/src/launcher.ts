import type { EventName } from "@boardgamers/protocol";
import { downlinkSchemas, uplinkSchemas } from "@boardgamers/protocol";
import { createViewer } from "@boardgamers/protocol/viewer";
import type { PremoveCommand } from "@gaia-project/engine/src/premove-types";
import BootstrapVue from "bootstrap-vue";
import { EventEmitter } from "events";
import Vue from "vue";
import type { VueConstructor } from "vue/types/umd";
import Condition from "./components/Condition.vue";
import Game from "./components/Game.vue";
import Resource from "./components/Resource.vue";
import TechContent from "./components/TechContent.vue";
import { mountGameChat } from "./game-chat";
import { createBoardThumbnail, installPlayerCards } from "./host-presentation";
import { mountLocalization } from "./localization";
import { installBoardTouch } from "./logic/board-touch";
import { installActionSounds } from "./sounds";
import { makeStore } from "./store";

Vue.use(BootstrapVue);
Vue.component("Condition", Condition);
Vue.component("TechContent", TechContent);
Vue.component("Resource", Resource);

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

let dispose: (() => void) | undefined;
export function destroyViewer() {
  const cleanup = dispose;
  dispose = undefined;
  cleanup?.();
}

function launch(selector: string, component: VueConstructor<Vue> = Game) {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Viewer mount point not found: ${selector}`);
  dispose?.();
  const mountPoint = document.createElement("div");
  target.append(mountPoint);
  let lastMovedAt = 0;

  const store = makeStore();
  store.commit("hosted", true);
  let planTimer: ReturnType<typeof setTimeout>;

  const app = new Vue({
    store,
    render: (h) => h("div", { class: "container-fluid py-2" }, [h(component)]),
  }).$mount(mountPoint);

  // Touch tooltips open on click, so a first
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
  const hideTooltips = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target?.closest?.("[aria-describedby]")) app.$emit("bv::hide::tooltip");
  };
  document.addEventListener("click", hideTooltips, true);
  app.$once("hook:beforeDestroy", () => document.removeEventListener("click", hideTooltips, true));

  const removeBoardTouch = installBoardTouch(app.$el, () => app.$emit("bv::hide::tooltip"));
  app.$once("hook:beforeDestroy", removeBoardTouch);

  const item: EventEmitter & { store: typeof store; app: Vue } = Object.assign(new EventEmitter(), { store, app });

  const thumbnail = createBoardThumbnail(app.$el);
  const localization = mountLocalization(target.ownerDocument.body);
  let replaying = false;
  const viewer = createViewer<Record<string, any>, string | PremoveCommand>({
    async onThumbnail(size) {
      await app.$nextTick();
      return thumbnail.render(app.$el.querySelector(".space-map-canvas, .old-map-canvas"), size, "#10172b");
    },
    async onState(data) {
      localization.setState(data);
      await store.dispatch("externalData", data);
      if (!replaying) viewer.replaceLog(data?.moveHistory || []);
      await app.$nextTick();
    },
    onUpdate() {
      viewer.fetchState();
    },
    onSettings(data) {
      store.commit("playerSettings", data);
    },
    onPreferences(data) {
      localization.setLocale(data.locale);
      store.commit("preferences", data);
    },
    onPlayer(data) {
      store.commit("player", data);
    },
    onAvatars(data) {
      store.commit("avatars", data);
    },
    onTheme({ dark }) {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    },
    onReplayStart() {
      replaying = true;
      void store.dispatch("replayStart");
    },
    onReplayTo(index) {
      void store.dispatch("replayTo", index);
      viewer.replaceLog(store.state.data.moveHistory);
    },
    onReplayEnd() {
      void store.dispatch("replayEnd");
      replaying = false;
      viewer.fetchState();
    },
    async onLog(logData) {
      if (replaying) return;
      const data = logData.data as { state?: unknown } | undefined;
      if (data?.state) {
        await store.dispatch("externalData", data.state);
        viewer.replaceLog(store.state.data.moveHistory);
        await app.$nextTick();
      } else viewer.fetchState();
    },
    onError(error) {
      if (item.listenerCount("error")) item.emit("error", error);
      else console.error(error);
    },
  });
  // Standard game actions, including premoves, use the BGS protocol.
  for (const event of Object.keys(downlinkSchemas)) {
    item.on(event, (payload) => viewer.emitter.receive(event, payload));
  }
  for (const event of Object.keys(uplinkSchemas) as EventName[]) {
    viewer.emitter.on(event, (payload) => item.emit(event, payload));
  }
  for (const event of ["seatUsers", "seatLastActive", "presence"]) {
    item.on(event, (data) => store.commit(event, data));
  }
  installActionSounds(viewer.emitter);
  const removeCards = installPlayerCards(app.$el, viewer);
  const removeChat = mountGameChat(viewer.emitter, app.$el);
  app.$once("hook:beforeDestroy", () => {
    localization.destroy();
    removeCards();
    thumbnail.destroy();
    removeChat();
    viewer.destroy();
    item.removeAllListeners();
  });
  dispose = () => {
    app.$destroy();
    target.replaceChildren();
  };

  const unsub1 = store.subscribeAction(({ type, payload }) => {
    // console.log("spy action", type, payload);

    if (type === "updatePlayerSetting") {
      viewer.updateSetting(payload.name, payload.value);
      return;
    }

    if (type === "move") {
      // There's a bug with the viewer, after an undo on some occasions moves are emitted twice in a row
      if (lastMovedAt + 50 > Date.now()) {
        return;
      }
      lastMovedAt = Date.now();

      viewer.move(payload);
      return;
    }

    if (type === "submitPlan") {
      store.commit("submittingPlan", payload);
      clearTimeout(planTimer);
      planTimer = setTimeout(() => {
        if (store.state.pendingPlan?.requestId !== payload.requestId) return;
        store.commit(
          "planError",
          "The server has not confirmed your plan. Your plan is still saved. Check the queue before trying again."
        );
        viewer.fetchState();
      }, 15000);
      viewer.move(payload);
      return;
    }

    if (type === "playerClick") {
      const index = store.state.data?.players?.findIndex((pl) => pl === payload);
      if (index >= 0) viewer.openPlayer(index);
    }

    if (type === "replayInfo") {
      viewer.setReplayInfo(payload);
    }
  });

  const unsub2 = store.subscribe(({ type, payload }) => {
    // console.log("spy mutation", type, payload);

    if (type === "info" || type === "error") {
      item.emit(type, payload);
    }
  });

  app.$once("hook:beforeDestroy", () => {
    clearTimeout(planTimer);
    unsub1();
    unsub2();
  });

  return item;
}

export default launch;
