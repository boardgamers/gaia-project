import launch from './launcher';
import Engine from '@gaia-project/engine';

import Wrapper from './components/Wrapper.vue';
import Game from './components/Game.vue';

function launchSelfContained (selector = "#app", debug = true) {
  const emitter = launch(selector, debug ? Wrapper : Game);

  let engine = new Engine(["init 3 randomSeed2","p1 faction lantids","p2 faction geodens","p3 faction ivits","lantids build m 6B4","geodens build m 2A3","geodens build m 9A3","lantids build m 8A0","ivits build PI 2A7","ivits booster booster2","geodens booster booster4","lantids booster booster5","ivits income 4pw","lantids build ts 6B4.","geodens charge 1pw","geodens build m 2B3.","ivits charge 3pw"], {});
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
