import launch from './launcher';
import Engine from '@gaia-project/engine';

import Wrapper from './components/Wrapper.vue';
import Game from './components/Game.vue';

function launchSelfContained (selector = "#app", debug = true) {
  const emitter = launch(selector, debug ? Wrapper : Game);

  let engine = new Engine(["init 2 randomSeed2","p1 faction itars","p2 faction baltaks","itars build m 8B1","baltaks build m 4B1","baltaks build m 8B3","itars build m 4A1","baltaks booster booster1","itars booster booster3","itars build ts 4A1.","baltaks charge 1pw","baltaks spend 1gf for 1q. build ts 4B1.","itars charge 2pw"], {layout: 'xshape'});
  engine.generateAvailableCommandsIfNeeded();

  const unsub = emitter.store.subscribeAction(({ payload, type }) => {
    if (type === "gaiaViewer/loadFromJSON") {
      const egData: Engine = payload;
      engine = new Engine(egData.moveHistory, egData.options);
      engine.generateAvailableCommandsIfNeeded();
      emitter.emit("state", JSON.parse(JSON.stringify(engine)));
    }
  });
  emitter.app.$once("hook:beforeDestroy", unsub);

  emitter.on("move", (move: string) => {
    console.log("executing move", move);
    const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));

    if (move) {
      copy.move(move);
      copy.generateAvailableCommandsIfNeeded();

      // Only save updated version if a full turn was done
      if (copy.newTurn) {
        engine = copy;
      }
    }

    emitter.emit("state", JSON.parse(JSON.stringify(copy)));
  });

  emitter.emit("state", JSON.parse(JSON.stringify(engine)));
}

export default launchSelfContained;
