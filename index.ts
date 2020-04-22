import Game from './src/components/Game.vue';

import { gaiaViewer, makeStore } from './src/store';
import { GameApi } from './src/types/api';
import Vue from "vue";
import { EventEmitter } from 'events';

export {Game, gaiaViewer, GameApi, makeStore};

function launch(selector: string) {
  const store = makeStore();

  const app = new Vue({
    store,
    render: (h) => h(Game),
  }).$mount(selector);

  const item = new EventEmitter();

  item.addListener("state:updated", data => store.commit("receiveData", data));

  const unsub1 = store.subscribeAction(({type, payload}) => {
    if (type === "move") {
      item.emit("move", payload);
    }
  });

  const unsub2 = store.subscribe(({type, payload}) => {
    if (type == "info" || type == "error") {
      item.emit(type, payload);
    }
  });

  app.$once("hook:beforeDestroy", () => {
    unsub1();
    unsub2();
  });
}

export default launch;