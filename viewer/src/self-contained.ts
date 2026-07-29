import Engine, { FactionVariant } from "@gaia-project/engine";
import { AuctionVariant, Layout } from "@gaia-project/engine/src/engine";
import Game from "./components/Game.vue";
import Wrapper from "./components/Wrapper.vue";
import { seatToLock } from "./hosted/host";
import { offlineMirrorSeatLock } from "./hosted/offline-mirror";
import launch from "./launcher";
import { autoDecideChargePower, parseAutoChargePreference } from "./logic/auto-decide";
import {
  announceOfflineGameSave,
  isOfflineGameMode,
  offlineGameIdFromSearch,
  readStoredOfflineGame,
  requestPersistentOfflineStorage,
  restoreOfflineGame,
  writeStoredOfflineGame,
} from "./offline-game";
import { LoadFromJson, LoadFromJsonType } from "./store";
import { loadScenarioEngine, parseScenarioFromQuery } from "./self-contained-scenarios";
import { loadEngineFromData, parseLoadFromQuery } from "./self-contained-state";

type SelfContainedEnv = Record<string, string | undefined>;

export type SelfContainedSetup = {
  players: number;
  seed: string | number;
  moves: string[];
  options: {
    layout: Layout | undefined;
    auction: AuctionVariant | undefined;
    banPhase: boolean | undefined;
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
  const optionalFlag = (key: string, envValue?: string): boolean | undefined => {
    const paramValue = params.get(key);
    if (paramValue !== null) {
      return parseFlagValue(paramValue) ?? false;
    }
    return parseFlagValue(envValue);
  };
  const flag = (key: string, envValue?: string): boolean => optionalFlag(key, envValue) ?? false;

  let players = Number(str("players", env.VUE_APP_players) ?? 3);
  if (!Number.isInteger(players) || players < 2 || players > 5) {
    console.warn(`Invalid players "${params.get("players")}"; falling back to 3 (valid range: 2-5)`);
    players = 3;
  }

  const auctionValue = str("auction", env.VUE_APP_auction);
  const auction =
    auctionValue === "none" || auctionValue === ""
      ? undefined
      : auctionValue != null
      ? (auctionValue as AuctionVariant)
      : params.has("offline")
      ? AuctionVariant.Silent
      : undefined;
  const banPhase = optionalFlag("banPhase", env.VUE_APP_banPhase) ?? (params.has("offline") ? true : undefined);

  return {
    players,
    seed: str("seed", env.VUE_APP_seed) ?? Math.floor(Math.random() * 10000),
    moves: env.VUE_APP_moves ? JSON.parse(env.VUE_APP_moves) : [],
    options: {
      layout: (str("layout", env.VUE_APP_layout) ?? undefined) as Layout,
      auction,
      banPhase,
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
  // auction (none|silent|choose-bid|bid-while-choosing), banPhase,
  // factionVariant (standard|more-balanced|beta), and the flags
  // randomFactions, advancedRules (alias rotateSectors), customBoardSetup,
  // frontiers, lostFleet. Alternatively, ?state=<base64url-json> boots
  // directly into an exported game state, and ?scenario=<id> loads a named
  // Lost Fleet test position. State URLs take precedence over scenario URLs.
  // Optional loadType and stopMove are supported for state URLs.
  const search = typeof window !== "undefined" ? window.location.search : "";
  const { moves, options, players, seed } = parseSelfContainedSetup(search, process.env);
  const offlineMode = isOfflineGameMode(search);
  const offlineGameId = offlineMode ? offlineGameIdFromSearch(search) : null;
  console.log("self-contained game setup:", { players, seed, ...options });

  if (offlineMode) {
    requestPersistentOfflineStorage().catch(() => undefined);
    if (!offlineGameId && typeof window !== "undefined") {
      window.location.replace("?offline=1");
      return;
    }
  }

  let engine: Engine;
  let initialDisplayEngine: Engine;
  let restoredPendingMove = "";
  let restoredOfflineSave = false;
  let rewriteRestoredSave = false;
  // A copy of an online game (hosted/offline-mirror.ts) is not a hot-seat game: whatever is played
  // here becomes a real committed turn in the hosted game as soon as this browser is back online,
  // and only a seat this account holds can ever be committed for. So the same seat lock hosted play
  // uses applies here, instead of letting a whole table be played and then refused on upload.
  // `null` for every ordinary pass-and-play game (and for a mirrored record written before seats
  // were recorded), which keeps its unlocked hot seat; an empty array means a mirrored game this
  // account holds no seat in - a spectator's copy, readable but not playable, since not one of its
  // moves could ever be committed online.
  let mirrorSeats: number[] | null = null;
  try {
    const initialLoad = parseLoadFromQuery(search);
    const scenarioId = parseScenarioFromQuery(search);
    const stored =
      offlineMode && offlineGameId && !initialLoad && !scenarioId ? readStoredOfflineGame(offlineGameId) : null;

    if (stored?.error) {
      console.warn(stored.error);
    }

    if (offlineMode && !initialLoad && !scenarioId && !stored?.save) {
      if (typeof window !== "undefined") {
        window.location.replace("?offline=1");
      }
      return;
    }

    if (stored?.save) {
      mirrorSeats = offlineMirrorSeatLock(stored.save);
      const restored = restoreOfflineGame(stored.save);
      engine = restored.engine;
      initialDisplayEngine = restored.displayEngine;
      restoredPendingMove = restored.pendingMove;
      restoredOfflineSave = true;
      rewriteRestoredSave = !!restored.warning || restored.pendingMove !== (stored.save.pendingMove ?? "");
      if (restored.warning) {
        console.warn(restored.warning);
      }
    } else {
      engine = initialLoad
        ? loadEngineFromData(initialLoad)
        : scenarioId
        ? loadScenarioEngine(scenarioId)
        : new Engine([`init ${players} ${seed}`, ...moves], options);
      initialDisplayEngine = engine;
    }
  } catch (error) {
    if (offlineMode) {
      console.error("could not restore offline game", error);
      if (typeof window !== "undefined") {
        window.location.replace("?offline=1");
      }
      return;
    }
    console.error("could not load state from URL, falling back to fresh self-contained setup", error);
    engine = new Engine([`init ${players} ${seed}`, ...moves], options);
    initialDisplayEngine = engine;
  }
  engine.generateAvailableCommandsIfNeeded();
  if (initialDisplayEngine !== engine) {
    initialDisplayEngine.generateAvailableCommandsIfNeeded();
  }

  const persistOfflineGame = (pendingMove = "") => {
    if (!offlineMode || !offlineGameId) {
      return;
    }
    const result = writeStoredOfflineGame(offlineGameId, engine, pendingMove);
    announceOfflineGameSave(result);
    if (result.error) {
      console.error(result.error);
    }
  };

  if (offlineMode && (!restoredOfflineSave || rewriteRestoredSave)) {
    persistOfflineGame(restoredPendingMove);
  }

  const unsub = emitter.store.subscribeAction(({ payload, type }) => {
    if (type === "loadFromJSON") {
      const p: LoadFromJson = payload;

      console.log("load from JSON", p);
      engine = loadEngineFromData({
        engineData: p.engineData,
        type: p.type,
        stopMove: p.stopMove,
      });
      engine.generateAvailableCommandsIfNeeded();
      persistOfflineGame();
      emitStateWithSeatLock(JSON.parse(JSON.stringify(engine)));
    }
  });
  emitter.app.$once("hook:beforeDestroy", unsub);

  // Lets the board explain itself when a mirrored copy is showing someone else's turn (Game.vue):
  // without it the action area is simply empty, which reads as broken rather than as "not yours".
  emitter.store.commit("setOfflineMirror", mirrorSeats !== null);

  // Emits a state and, for a mirrored copy only, re-applies the seat lock for whoever must act in
  // it - the same rule hosted play uses (host.ts's `seatToLock`), so a leech interrupt unlocks the
  // right seat and a player holding every seat still plays freely.
  const emitStateWithSeatLock = (data: any) => {
    emitter.emit("state", data);
    if (mirrorSeats) {
      const lock = seatToLock(mirrorSeats, data?.players?.length ?? 0, data?.playerToMove);
      emitter.emit("player", lock !== null ? { index: lock } : null);
    }
  };

  emitter.on("move", (move: string) => {
    const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));

    if (move) {
      copy.move(move);
      copy.generateAvailableCommandsIfNeeded();

      // Only save updated version if a full turn was done
      if (copy.newTurn) {
        engine = copy;

        // "Auto leech" (see logic/auto-decide.ts): hot-seat/self-contained play has no per-browser
        // "my seat" concept - whoever's turn it now is uses the same local preference, exactly
        // like every other viewer preference (flatBuildings etc.) already does.
        const pref = parseAutoChargePreference(emitter.store.state.preferences.autoChargePower as string);
        autoDecideChargePower(engine, pref);
        engine.generateAvailableCommandsIfNeeded();
      }
    }

    persistOfflineGame(copy.newTurn ? "" : move);

    emitStateWithSeatLock(JSON.parse(JSON.stringify(copy)));
  });

  emitStateWithSeatLock(JSON.parse(JSON.stringify(initialDisplayEngine)));
}

export default launchSelfContained;
