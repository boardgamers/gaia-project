import Engine from "@gaia-project/engine";

export const OFFLINE_GAME_STORAGE_KEY = "gaia-offline-game-v1";
export const OFFLINE_GAME_SAVED_EVENT = "gaia-offline-game-saved";

const OFFLINE_GAME_SAVE_VERSION = 1;

export type OfflineGameSave = {
  version: 1;
  savedAt: string;
  /** The last fully committed engine state. */
  engineData: any;
  /** A turn that is still being composed in the viewer, if there is one. */
  pendingMove?: string;
};

export type OfflineGameReadResult = {
  save: OfflineGameSave | null;
  error: string | null;
};

export type OfflineGameWriteResult = {
  save: OfflineGameSave | null;
  error: string | null;
};

export type RestoredOfflineGame = {
  /** Stable baseline used when the next cumulative command is submitted. */
  engine: Engine;
  /** State shown in the UI, including a partially composed turn when present. */
  displayEngine: Engine;
  pendingMove: string;
  warning: string | null;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isOfflineGameMode(search = ""): boolean {
  return new URLSearchParams(search).has("offline");
}

export function isNewOfflineGame(search = ""): boolean {
  const value = new URLSearchParams(search).get("new");
  return value === "" || /^(1|true|yes|on)$/i.test(value ?? "");
}

export function browserOfflineStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function isOfflineGameSave(value: any): value is OfflineGameSave {
  return (
    value?.version === OFFLINE_GAME_SAVE_VERSION &&
    typeof value.savedAt === "string" &&
    value.engineData != null &&
    Array.isArray(value.engineData.moveHistory) &&
    (value.pendingMove === undefined || typeof value.pendingMove === "string")
  );
}

export function readOfflineGame(storage: Storage | null = browserOfflineStorage()): OfflineGameReadResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }

  try {
    const raw = storage.getItem(OFFLINE_GAME_STORAGE_KEY);
    if (!raw) {
      return { save: null, error: null };
    }
    const parsed = JSON.parse(raw);
    if (!isOfflineGameSave(parsed)) {
      return { save: null, error: "The saved offline game has an unsupported format." };
    }
    return { save: parsed, error: null };
  } catch (error) {
    return { save: null, error: `The saved offline game could not be read: ${errorMessage(error)}` };
  }
}

/**
 * Synchronously writes one small, atomic localStorage record. A finished Gaia game is currently
 * about 140 KB, comfortably below normal browser quotas; synchronous storage is intentional here
 * so closing the tab immediately after a move cannot race an asynchronous write.
 */
export function writeOfflineGame(
  engine: Engine,
  pendingMove = "",
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now()
): OfflineGameWriteResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }

  try {
    const save: OfflineGameSave = {
      version: OFFLINE_GAME_SAVE_VERSION,
      savedAt: new Date(now).toISOString(),
      engineData: JSON.parse(JSON.stringify(engine)),
      ...(pendingMove ? { pendingMove } : {}),
    };
    storage.setItem(OFFLINE_GAME_STORAGE_KEY, JSON.stringify(save));
    return { save, error: null };
  } catch (error) {
    return { save: null, error: `The offline game could not be saved: ${errorMessage(error)}` };
  }
}

export function clearOfflineGame(storage: Storage | null = browserOfflineStorage()): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.removeItem(OFFLINE_GAME_STORAGE_KEY);
    return true;
  } catch (_error) {
    return false;
  }
}

export function restoreOfflineGame(save: OfflineGameSave): RestoredOfflineGame {
  let engine = Engine.fromData(JSON.parse(JSON.stringify(save.engineData)));
  engine.generateAvailableCommandsIfNeeded();

  const pendingMove = save.pendingMove ?? "";
  if (!pendingMove) {
    return { engine, displayEngine: engine, pendingMove: "", warning: null };
  }

  try {
    const displayEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    displayEngine.move(pendingMove);
    displayEngine.generateAvailableCommandsIfNeeded();

    // A pending command should not normally finish a turn (finished turns are saved in engineData),
    // but adopting it is safer if a newer engine version now resolves that command immediately.
    if (displayEngine.newTurn) {
      engine = displayEngine;
      return {
        engine,
        displayEngine,
        pendingMove: "",
        warning: "A previously unfinished move was completed while restoring the game.",
      };
    }

    return { engine, displayEngine, pendingMove, warning: null };
  } catch (error) {
    return {
      engine,
      displayEngine: engine,
      pendingMove: "",
      warning: `The last unfinished move could not be restored and was discarded: ${errorMessage(error)}`,
    };
  }
}

export function announceOfflineGameSave(result: OfflineGameWriteResult): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(OFFLINE_GAME_SAVED_EVENT, {
      detail: {
        savedAt: result.save?.savedAt ?? null,
        error: result.error,
      },
    })
  );
}

/** Best-effort protection against automatic storage eviction; unsupported browsers simply ignore it. */
export async function requestPersistentOfflineStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return null;
  }
  try {
    return await navigator.storage.persist();
  } catch (_error) {
    return null;
  }
}
