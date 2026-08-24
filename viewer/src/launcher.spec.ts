import { expect } from "chai";
import Vue from "vue";
import launch from "./launcher";

// Regression test for a real bug found in a live two-browser session (docs/lost-fleet/PROGRESS.md
// #73): launcher.ts's store.subscribeAction handler is the ONLY bridge from a Vuex action dispatch
// (e.g. PremoveBar.vue's `this.$store.dispatch("cancelAllPremoves", ...)`) to the event emitter
// a hosting app listens on to actually call the backend. `cancelAllPremoves` and `reorderPremove` were
// dispatched by the premove UI but never added to this bridge's forwarding list, so the mode-
// switch-clears-queue and reorder buttons did nothing server-side despite the UI (confirm dialog,
// button press state) looking like they worked - completely invisible to unit tests, since
// PremoveBar.vue itself has no component-level test and every other premove test exercises
// host.ts/resolvePremoveQueue directly, never through this bridge. Pin every premove-related action
// type actually dispatched from a component (including `editPremove`, added for the Gaia 9 premove
// UI redesign - Game.vue's queueCurrentPremove dispatches it) so a future one silently missing this
// list fails loudly here instead of only in a live session.
describe("launcher's store-to-emitter bridge", () => {
  const premoveActionTypes = [
    "queuePremove",
    "cancelPremove",
    "editPremove",
    "cancelAllPremoves",
    "reorderPremove",
    "markPremoveFailureRead",
  ];

  for (const type of premoveActionTypes) {
    it(`forwards a "${type}" dispatch to the emitter`, () => {
      const container = document.createElement("div");
      container.id = `launcher-spec-${type}`;
      document.body.appendChild(container);

      const item = launch(`#${container.id}`, Vue.component(`dummy-${type}`, { render: (h) => h("div") }));
      const payload = { seat: 0, seq: 1, move: "p1 up nav.", mode: "sequential", id: "abc" };

      let received: unknown = undefined;
      item.on(type, (p: unknown) => {
        received = p;
      });

      item.store.dispatch(type, payload);

      expect(received).to.deep.equal(payload);

      item.app.$destroy();
      // $mount(selector) replaces the matched element in place rather than mounting inside it, so
      // the live DOM node to clean up is item.app.$el, not the original (now-detached) container.
      item.app.$el.parentNode?.removeChild(item.app.$el);
    });
  }
});
