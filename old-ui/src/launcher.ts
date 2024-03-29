import BootstrapVue from "bootstrap-vue";
import { EventEmitter } from "events";
import Vue from "vue";
import type { VueConstructor } from "vue/types/umd";
import { Store } from "vuex";
import Game from "./components/Game.vue";
import { makeStore } from "./store";

Vue.use(BootstrapVue);

function launch(selector: string, component: VueConstructor<Vue> = Game) {
  const store = makeStore();

  const app = new Vue({
    store,
    render: (h) => h("div", { class: "container-fluid py-2" }, [h(component)]),
  }).$mount(selector);

  const item: EventEmitter & { store?: Store<unknown>; app?: Vue } = new EventEmitter();

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
      item.emit("move", payload);
      return;
    }

    if (type === "playerClick") {
      item.emit("player:clicked", {
        name: payload.name,
        auth: payload.auth,
        index: (store as Store<any>).state.data?.players?.findIndex((pl) => pl === payload),
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

  item.store = store;
  item.app = app;

  return item;
}

export default launch;
