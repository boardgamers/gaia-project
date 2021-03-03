import Engine from "@gaia-project/engine";
import Game from "./components/Game.vue";
import Wrapper from "./components/Wrapper.vue";
import launch from "./launcher";

function launchSelfContained(selector = "#app", debug = true) {
  const emitter = launch(selector, debug ? Wrapper : Game);

  let engine = new Engine([
    "init 3 12",
    "p1 faction ivits",
    "p2 faction baltaks",
    "p3 faction gleens",
    "baltaks build m 1x3",
    "gleens build m -5x4",
    "gleens build m 2x0",
    "baltaks build m -2x-2",
    "ivits build PI 7B3",
  ]);
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
