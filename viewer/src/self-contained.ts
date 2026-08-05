import Engine, { FactionVariant } from "@gaia-project/engine";
import { AuctionVariant, Layout } from "@gaia-project/engine/src/engine";
import Game from "./components/Game.vue";
import Wrapper from "./components/Wrapper.vue";
import launch from "./launcher";
import { autoDecideChargePower, parseAutoChargePreference } from "./logic/auto-decide";
import { discardOfflineMinigameMirror } from "./logic/offline-minigame-sync";
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
    auctionBudget: number | undefined;
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
  // Preference Split Auction's per-player bid budget; left undefined (engine default) unless a
  // whole number was actually supplied.
  const budgetValue = str("auctionBudget", env.VUE_APP_auctionBudget);
  const auctionBudget = budgetValue != null && /^\d+$/.test(budgetValue) ? Number(budgetValue) : undefined;

  return {
    players,
    seed: str("seed", env.VUE_APP_seed) ?? Math.floor(Math.random() * 10000),
    moves: env.VUE_APP_moves ? JSON.parse(env.VUE_APP_moves) : [],
    options: {
      layout: (str("layout", env.VUE_APP_layout) ?? undefined) as Layout,
      auction,
      auctionBudget,
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

/**
 * Bouncing straight back to the offline lobby is right - a game that cannot be restored has nothing
 * to render - but doing it SILENTLY meant the player saw only a flash of the game page and never
 * learned why (owner report: "it just flashes quickly and I can see a green box appear at top but
 * can[not] read what it says because it's too quick"). The reason rides along in the URL so the
 * lobby can show it, which also makes it reportable instead of lost.
 */
function returnToOfflineLobby(reason: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("offline", "1");
  url.searchParams.set("error", reason.slice(0, 300));
  window.location.replace(url.toString());
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
  try {
    const initialLoad = parseLoadFromQuery(search);
    const scenarioId = parseScenarioFromQuery(search);
    const stored =
      offlineMode && offlineGameId && !initialLoad && !scenarioId ? readStoredOfflineGame(offlineGameId) : null;

    if (stored?.error) {
      console.warn(stored.error);
    }

    if (offlineMode && !initialLoad && !scenarioId && !stored?.save) {
      returnToOfflineLobby(stored?.error ?? "That game is not stored on this device.");
      return;
    }

    if (stored?.save) {
      // Copies created by the former two-way mirror become ordinary pass-and-play games too. Drop
      // the minigames' legacy account/assignment lock while retaining their last local positions.
      if (stored.save.mirrorOf && offlineGameId) {
        discardOfflineMinigameMirror(offlineGameId);
      }
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
      returnToOfflineLobby(`That game could not be opened: ${error instanceof Error ? error.message : error}`);
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

  // Every offline game is pass-and-play. No player lock is emitted, so whichever seat is active can
  // take its turn on this device.
  const emitState = (data: any) => {
    emitter.emit("state", data);
  };

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
      emitState(JSON.parse(JSON.stringify(engine)));
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

        // "Auto leech" (see logic/auto-decide.ts): hot-seat/self-contained play has no per-browser
        // "my seat" concept - whoever's turn it now is uses the same local preference, exactly
        // like every other viewer preference (flatBuildings etc.) already does.
        const pref = parseAutoChargePreference(emitter.store.state.preferences.autoChargePower as string);
        autoDecideChargePower(engine, pref);
        engine.generateAvailableCommandsIfNeeded();
      }
    }

    persistOfflineGame(copy.newTurn ? "" : move);

    emitState(JSON.parse(JSON.stringify(copy)));
  });

  emitState(JSON.parse(JSON.stringify(initialDisplayEngine)));
}

export default launchSelfContained;
