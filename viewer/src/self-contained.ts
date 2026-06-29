import Engine, { FactionVariant } from "@gaia-project/engine";
import { AuctionVariant, Layout } from "@gaia-project/engine/src/engine";
import Game from "./components/Game.vue";
import Wrapper from "./components/Wrapper.vue";
import launch from "./launcher";
import { LoadFromJson, LoadFromJsonType } from "./store";

type SelfContainedEnv = Record<string, string | undefined>;

export type SelfContainedSetup = {
  players: number;
  seed: string | number;
  moves: string[];
  options: {
    layout: Layout | undefined;
    auction: AuctionVariant | undefined;
    factionVariant: FactionVariant;
    randomFactions: boolean;
    advancedRules: boolean;
    customBoardSetup: boolean;
    frontiers: boolean;
    lostFleet: boolean;
  };
};

function parseFlagValue(value?: string | null): boolean | undefined {
  if (value == null) {
    return undefined;
  }
  if (value === "") {
    return true;
  }
  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }
  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }
  return true;
}

export function parseSelfContainedSetup(search = "", env: SelfContainedEnv = process.env): SelfContainedSetup {
  const params = new URLSearchParams(search);
  const str = (key: string, envValue?: string) => params.get(key) ?? envValue;
  const flag = (key: string, envValue?: string): boolean => {
    const paramValue = params.get(key);
    if (paramValue !== null) {
      return parseFlagValue(paramValue) ?? false;
    }
    return parseFlagValue(envValue) ?? false;
  };

  let players = Number(str("players", env.VUE_APP_players) ?? 3);
  if (!Number.isInteger(players) || players < 2 || players > 5) {
    console.warn(`Invalid players "${params.get("players")}"; falling back to 3 (valid range: 2-5)`);
    players = 3;
  }

  return {
    players,
    seed: str("seed", env.VUE_APP_seed) ?? Math.floor(Math.random() * 10000),
    moves: env.VUE_APP_moves ? JSON.parse(env.VUE_APP_moves) : [],
    options: {
      layout: (str("layout", env.VUE_APP_layout) ?? undefined) as Layout,
      auction: (str("auction", env.VUE_APP_auction) ?? undefined) as AuctionVariant,
      factionVariant: (str("factionVariant", env.VUE_APP_factionVariant) ?? "standard") as FactionVariant,
      randomFactions: flag("randomFactions", env.VUE_APP_randomFactions),
      advancedRules: flag("advancedRules") || flag("rotateSectors", env.VUE_APP_rotateSectors),
      customBoardSetup: flag("customBoardSetup", env.VUE_APP_customBoardSetup),
      frontiers: flag("frontiers", env.VUE_APP_frontiers),
      lostFleet: flag("lostFleet", env.VUE_APP_lostFleet),
    },
  };
}

function launchSelfContained(selector = "#app", debug = true) {
  const emitter = launch(selector, debug ? Wrapper : Game);

  // Game setup can be configured at runtime via URL query params (no rebuild
  // needed) — e.g. ?players=4&seed=42&factionVariant=beta&frontiers=1
  // Query params take precedence over the VUE_APP_* build-time env vars.
  // Supported: players (2-5), seed, layout (standard|balanced|xshape),
  // auction (choose-bid|bid-while-choosing),
  // factionVariant (standard|more-balanced|beta), and the flags
  // randomFactions, advancedRules (alias rotateSectors), customBoardSetup,
  // frontiers, lostFleet.
  const { moves, options, players, seed } = parseSelfContainedSetup(
    typeof window !== "undefined" ? window.location.search : "",
    process.env
  );
  console.log("self-contained game setup:", { players, seed, ...options });

  let engine = new Engine([`init ${players} ${seed}`, ...moves], options);
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
    }
  });
  emitter.app.$once("hook:beforeDestroy", unsub);

  emitter.on("move", (move: string) => {
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
