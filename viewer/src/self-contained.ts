import Engine, { FactionVariant } from "@gaia-project/engine";
import { AuctionVariant, Layout } from "@gaia-project/engine/src/engine";
import Game from "./components/Game.vue";
import Wrapper from "./components/Wrapper.vue";
import launch from "./launcher";

function launchSelfContained(selector = "#app", debug = true) {
  const emitter = launch(selector, debug ? Wrapper : Game);

  const players = process.env.VUE_APP_players ?? 3;
  const seed = process.env.VUE_APP_seed ?? Math.floor(Math.random() * 10000);
  const moves = process.env.VUE_APP_moves ? JSON.parse(process.env.VUE_APP_moves) : [];
  let engine = new Engine([`init ${players} ${seed}`, ...moves], {
    layout: (process.env.VUE_APP_layout ?? undefined) as Layout,
    auction: (process.env.VUE_APP_auction ?? undefined) as AuctionVariant,
    factionVariant: (process.env.VUE_APP_factionVariant ?? "standard") as FactionVariant,
    randomFactions: !!process.env.VUE_APP_randomFactions,
    advancedRules: !!process.env.VUE_APP_rotateSectors,
  });
  engine.generateAvailableCommandsIfNeeded();

  const unsub = emitter.store.subscribeAction(({ payload, type }) => {
    if (type === "loadFromJSON") {
      const egData: Engine = payload;
      engine = egData.players ? Engine.fromData(egData) : new Engine(egData.moveHistory, egData.options, null);
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
