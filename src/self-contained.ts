import launch from './launcher';
import Engine from '@gaia-project/engine';

function launchSelfContained() {
  const emitter = launch("#app");

  let engine = new Engine();

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

    emitter.emit("state:updated", copy);
  });
}

export default launchSelfContained;