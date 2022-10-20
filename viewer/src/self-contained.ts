import Engine, { autoMove, FactionVariant } from "@gaia-project/engine";
import { AuctionVariant, Layout } from "@gaia-project/engine/src/engine";
import Game from "./components/Game.vue";
import Wrapper from "./components/Wrapper.vue";
import launch from "./launcher";
import { LoadFromJson, LoadFromJsonType } from "./store";

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
    customBoardSetup: !!process.env.VUE_APP_customBoardSetup,
    frontiers: !!process.env.VUE_APP_frontiers,
  });
  engine.generateAvailableCommandsIfNeeded();

  const unsub = emitter.store.subscribeAction(({ payload, type }) => {
    if (type === "loadFromJSON") {
      const p: LoadFromJson = payload;

      console.log("load from JSON", p);
      let egData = p.engineData;
      if ("cancelled" in egData) {
        egData = (egData as any).data;
      }
      let moveHistory = egData.moveHistory;
      let type = p.type;
      if (p.stopMove) {
        let index = Number(p.stopMove);
        if (Number.isNaN(index)) {
          index = moveHistory.indexOf(p.stopMove);
        }

        if (index < 0) {
          console.error("stop move not found", p.stopMove);
          console.log(moveHistory);
        } else {
          moveHistory = moveHistory.slice(0, index);
          console.log("loading game from index", index);
        }

        if (type == LoadFromJsonType.load) {
          console.error("cannot use load with stop move - using permissive replay instead", type);
          type = LoadFromJsonType.permissiveReplay;
        }
      }
      switch (type) {
        case LoadFromJsonType.load:
          engine = Engine.fromData(egData);
          break;
        case LoadFromJsonType.strictReplay:
          engine = new Engine(moveHistory, egData.options, null);
          break;
        case LoadFromJsonType.permissiveReplay:
          engine = new Engine(moveHistory, egData.options, null, true);
          break;
        default:
          console.error("unknown replay type", type);
      }
      engine.generateAvailableCommandsIfNeeded();
      emitter.emit("state", JSON.parse(JSON.stringify(engine)));
      return;
    }
    if (type === "automove") {
      const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));

      if (autoMove(copy)) {
        console.log("automove sucessful");
        emitter.emit("state", JSON.parse(JSON.stringify(copy)));
      } else {
        console.log("automove failed");
      }
      return;
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
