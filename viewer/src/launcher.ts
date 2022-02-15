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

function launch(selector: string, component: VueConstructor<Vue> = Game) {
  let lastMovedAt: number = 0;

  const store = makeStore();

  const app = new Vue({
    store,
    render: (h) => h("div", { class: "container-fluid py-2" }, [h(component)]),
  }).$mount(selector);

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
