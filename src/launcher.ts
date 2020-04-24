import Vue from "vue";
import { Store } from "vuex";
import BootstrapVue from 'bootstrap-vue';
import { EventEmitter } from 'events';

import {makeStore} from './store';
import Game from './components/Game.vue';

Vue.use(BootstrapVue);

function launch(selector: string) {
  const store = makeStore();

  const app = new Vue({
    store,
    render: (h) => h("div", {class: "container-fluid py-2"}, [h(Game)]),
  }).$mount(selector);

  const item = new EventEmitter();

  item.addListener("state:updated", data => store.dispatch("gaiaViewer/externalData", data));
  item.addListener("preferences", data => store.commit("gaiaViewer/preferences", data));

  const unsub1 = store.subscribeAction(({type, payload}) => {
    // console.log("spy action", type, payload);

    if (type === "gaiaViewer/move") {
      item.emit("move", payload);
      return;
    }

    if (type === "gaiaViewer/playerClick") {
      item.emit("player:clicked", {name: payload.name, auth: payload.auth, index: (store as Store<any>).state.gaiaViewer.data?.players?.findIndex(pl => pl === payload)});
    }
  });

  const unsub2 = store.subscribe(({type, payload}) => {
    // console.log("spy mutation", type, payload);

    if (type == "info" || type == "error") {
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